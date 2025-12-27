const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Web scraping service for job search using Puppeteer
 * Browser is launched once on server startup
 * Each user (identified by JWT) gets ONE dedicated tab that is reused
 * This reduces load and allows concurrent users
 */

class JobScraperService {
  
  constructor() {
    this.browser = null;
    this.browserPromise = null;
    this.isInitialized = false;
    
    // Map of userId -> { page, lastUsed }
    this.userTabs = new Map();
    
    // Cleanup interval - close tabs inactive for more than 30 minutes
    this.cleanupInterval = null;
    this.INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Initialize browser on server startup
   * This should be called once when server starts
   */
  async initializeBrowser() {
    if (this.isInitialized || this.browser) {
      console.log('Browser already initialized');
      return this.browser;
    }

    if (this.browserPromise) {
      console.log('Browser initialization in progress, waiting...');
      return await this.browserPromise;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    
    const browserConfig = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-http2',
        '--disable-blink-features=AutomationControlled'
      ]
    };

    if (isProduction) {
      browserConfig.args.push(
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      );
    }

    console.log('🚀 Initializing Puppeteer browser on server startup...');
    console.log('   Environment:', isProduction ? 'Production' : 'Development');

    this.browserPromise = puppeteer.launch(browserConfig)
      .then(browser => {
        console.log('✅ Browser launched successfully and ready for requests');
        this.browser = browser;
        this.browserPromise = null;
        this.isInitialized = true;
        
        // Start cleanup interval for inactive tabs
        this.startCleanupInterval();
        
        // Handle browser disconnection
        browser.on('disconnected', () => {
          console.log('⚠️  Browser disconnected, clearing all user tabs');
          this.userTabs.clear();
          this.browser = null;
          this.isInitialized = false;
          if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
          }
        });
        
        return browser;
      })
      .catch(error => {
        console.error('❌ Failed to launch browser:', error.message);
        this.browserPromise = null;
        this.isInitialized = false;
        throw error;
      });
    
    return await this.browserPromise;
  }

  /**
   * Start cleanup interval to close inactive tabs
   */
  startCleanupInterval() {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const inactiveTabs = [];
      
      for (const [userId, tabInfo] of this.userTabs.entries()) {
        if (now - tabInfo.lastUsed > this.INACTIVE_TIMEOUT) {
          inactiveTabs.push(userId);
        }
      }
      
      if (inactiveTabs.length > 0) {
        console.log(`🧹 Cleaning up ${inactiveTabs.length} inactive user tabs`);
        inactiveTabs.forEach(userId => this.closeUserTab(userId));
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Get or create a dedicated tab for a user
   * Each user gets ONE tab that is reused for all their requests
   */
  async getUserTab(userId) {
    if (!userId) {
      throw new Error('User ID is required for tab management');
    }

    const browser = await this.getBrowser();
    
    // Check if user already has a tab
    if (this.userTabs.has(userId)) {
      const tabInfo = this.userTabs.get(userId);
      
      // Check if page is still valid
      if (tabInfo.page && !tabInfo.page.isClosed()) {
        // Update last used time
        tabInfo.lastUsed = Date.now();
        console.log(`♻️  Reusing existing tab for user: ${userId.substring(0, 8)}...`);
        return tabInfo.page;
      } else {
        // Page was closed, remove from map
        this.userTabs.delete(userId);
      }
    }

    // Create new tab for user
    console.log(`📄 Creating new tab for user: ${userId.substring(0, 8)}...`);
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Store tab info
    this.userTabs.set(userId, {
      page,
      lastUsed: Date.now(),
      createdAt: Date.now()
    });
    
    console.log(`📊 Total active user tabs: ${this.userTabs.size}`);
    
    return page;
  }

  /**
   * Close a specific user's tab
   */
  async closeUserTab(userId) {
    if (this.userTabs.has(userId)) {
      const tabInfo = this.userTabs.get(userId);
      try {
        if (tabInfo.page && !tabInfo.page.isClosed()) {
          await tabInfo.page.close();
        }
      } catch (error) {
        console.error(`Error closing tab for user ${userId}:`, error.message);
      }
      this.userTabs.delete(userId);
      console.log(`🗑️  Closed tab for user: ${userId.substring(0, 8)}...`);
    }
  }

  /**
   * Get browser instance, reinitialize if needed
   */
  async getBrowser() {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    console.log('Browser not available, reinitializing...');
    return await this.initializeBrowser();
  }

  /**
   * Close browser instance (called on server shutdown)
   */
  async closeBrowser() {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Close all user tabs
    console.log(`Closing ${this.userTabs.size} user tabs...`);
    for (const [userId, tabInfo] of this.userTabs.entries()) {
      try {
        if (tabInfo.page && !tabInfo.page.isClosed()) {
          await tabInfo.page.close();
        }
      } catch (error) {
        console.error(`Error closing tab for ${userId}:`, error.message);
      }
    }
    this.userTabs.clear();
    
    // Close browser
    if (this.browser) {
      console.log('Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      console.log('Browser closed');
    }
  }

  /**
   * Search jobs from Naukri.com using user's dedicated tab
   * The same tab is reused for all requests from the same user
   */
  async searchJobsNaukari({ userId, role, location, experienceLevel, jobType }) {
    if (!userId) {
      throw new Error('User ID is required for job search');
    }

    let page;
    try {
      // Get or create user's dedicated tab
      page = await this.getUserTab(userId);
      
      console.log(`🔍 User ${userId.substring(0, 8)}... searching: ${role} in ${location}`);
      
      // Navigate to Naukri.com (overwrites previous URL in same tab)
      try {
        await page.goto('https://www.naukri.com/', { 
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        console.log('Page loaded successfully');
      } catch (navError) {
        console.log('Navigation error:', navError.message);
        throw new Error('Unable to access Naukri.com from this server. The site may be blocking cloud hosting IPs.');
      }

      let roleQuery = role + " " + jobType;
      console.log('Searching for:', { roleQuery, location, experienceLevel });
      
      // Wait for and fill job title field
      await page.waitForSelector('[placeholder="Enter skills / designations / companies"]', { timeout: 20000 });
      
      // Clear previous input and type new
      await page.click('[placeholder="Enter skills / designations / companies"]', { clickCount: 3 });
      await page.keyboard.press('Backspace');
      await page.type('[placeholder="Enter skills / designations / companies"]', roleQuery);
      
      if (location && location.toLowerCase() !== 'remote') {
        // Clear location field
        const locationInput = await page.$('.suggestor-input');
        if (locationInput) {
          await locationInput.click({ clickCount: 3 });
          await page.keyboard.press('Backspace');
        }
        
        await page.type('.suggestor-input', location);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
          await page.waitForSelector('.tuple-wrap .pre-wrap', { timeout: 15000 });
          await page.click('.tuple-wrap b.pre-wrap');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.log('No location suggestion found, continuing with typed value');
        }
      }

      if (experienceLevel) {
        await page.click('.qsbExperience .dropArrowDD');
        await page.click(`#sa-dd-scrollexpereinceDD [index="${experienceLevel}"]`);
      }
      
      await page.click('.qsb .qsbSubmit');
      
      await page.waitForNavigation({ 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const currentUrl = page.url();
      console.log('Search results URL:', currentUrl);
      
      const pageContent = await page.content();
      if (pageContent.includes('captcha') || pageContent.includes('Captcha')) {
        console.log('⚠️ CAPTCHA DETECTED');
      }
      if (pageContent.includes('Access Denied') || pageContent.includes('blocked')) {
        console.log('⚠️ ACCESS DENIED or BLOCKED');
      }
      
      try {
        await Promise.race([
          page.waitForSelector('.styles_job-listing-container__OCfZC', { timeout: 30000 }),
          page.waitForSelector('.srp-jobtuple-wrapper', { timeout: 30000 }),
          page.waitForSelector('[class*="job-listing"]', { timeout: 30000 })
        ]);
      } catch (error) {
        console.log('❌ Job listings not found');
        throw error;
      }
      
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let allJobs = [];
      let jobIdCounter = 1;
      
      // Scrape up to 3 pages
      for (let pageNum = 0; pageNum < 1; pageNum++) {
        console.log(`Scraping page ${pageNum + 1}...`);
        
        const jobs = await page.evaluate((startId) => {
          let jobCards = document.querySelectorAll('.srp-jobtuple-wrapper');
          if (jobCards.length === 0) {
            jobCards = document.querySelectorAll('[class*="job-tuple"]');
          }
          if (jobCards.length === 0) {
            jobCards = document.querySelectorAll('article');
          }
          
          const results = [];
          
          jobCards.forEach((card, index) => {
            const titleEl = card.querySelector('.title') || card.querySelector('[class*="title"]') || card.querySelector('a');
            const companyEl = card.querySelector('.comp-name') || card.querySelector('[class*="company"]');
            const locationEl = card.querySelector('.locWdth') || card.querySelector('[class*="location"]');
            const snippetEl = card.querySelector('.job-desc') || card.querySelector('[class*="desc"]');
            const salaryEl = card.querySelector('.sal-wrap') || card.querySelector('[class*="salary"]');
            const linkEl = card.querySelector('a')?.getAttribute('href') || '';
            
            const title = titleEl?.innerText?.trim() || '';
            const company = companyEl?.innerText?.trim() || '';
            const location = locationEl?.innerText?.trim() || 'Not specified';
            const description = snippetEl?.innerText?.trim() || '';
            const salary = salaryEl?.innerText?.trim() || 'Not disclosed';
            const jobUrl = linkEl;
            
            if (title && company) {
              results.push({
                id: `naukri_${startId + index}`,
                title,
                company,
                location,
                description,
                salary,
                url: jobUrl,
                source: 'Naukri',
                postedDate: 'Recently',
                type: 'Full-time'
              });
            }
          });
          
          return results;
        }, jobIdCounter);
        allJobs = [...allJobs, ...jobs];
        jobIdCounter += jobs.length;
        
        if (pageNum < 1) {
          try {
            await page.click('.styles_btn-secondary__2AsIP');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await page.evaluate(() => window.scrollBy(0, 1000));
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (error) {
            console.log('No more pages available');
            break;
          }
        }
      }
      
      console.log(`✅ Total jobs scraped: ${allJobs.length}`);
      
      // Update last used time
      if (this.userTabs.has(userId)) {
        this.userTabs.get(userId).lastUsed = Date.now();
      }
      
      return allJobs;
      
    } catch (error) {
      console.error('Error during scraping:', error.message);
      return [];
    }
    // Note: We do NOT close the page here - it's reused for the next request
  }

  /**
   * Main job search function
   * Uses the user's persistent tab
   */
  async searchJobs({ userId, role, designation, experienceLevel, location, jobType }) {
    try {
      const [naukriJobs] = await Promise.allSettled([
        this.searchJobsNaukari({ userId, role: role || designation, location, experienceLevel, jobType })
      ]);

      let allJobs = [];

      if (naukriJobs.status === 'fulfilled' && naukriJobs.value.length > 0) {
        allJobs = [...allJobs, ...naukriJobs.value];
      }

      // Filter jobs by location if provided
      if (location && location.trim() !== '') {
        allJobs = allJobs.filter(job => 
          job.location && job.location.toLowerCase().includes(location.toLowerCase())
        );
      }

      return allJobs;

    } catch (error) {
      console.error('Job search error:', error);
      throw error;
    }
  }
  
  /**
   * Get stats about current tab usage
   */
  getStats() {
    return {
      totalUsers: this.userTabs.size,
      browserInitialized: this.isInitialized,
      users: Array.from(this.userTabs.keys()).map(userId => ({
        userId: userId.substring(0, 8) + '...',
        lastUsed: new Date(this.userTabs.get(userId).lastUsed).toISOString(),
        createdAt: new Date(this.userTabs.get(userId).createdAt).toISOString()
      }))
    };
  }
}

module.exports = new JobScraperService();
