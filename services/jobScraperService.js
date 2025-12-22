const e = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Web scraping service for job search using Puppeteer
 * Full browser automation for interactive scraping
 * 
 * For production: Consider using job board APIs like:
 * - Indeed API, LinkedIn API, Adzuna API, etc.
 */

class JobScraperService {
  
  constructor() {
    this.browser = null;
    this.browserPromise = null; // Track browser launch promise
  }

  /**
   * Initialize browser with configuration
   * Render.com compatible settings
   */
  async getBrowser() {
    if (this.browser) {
      return this.browser;
    }

    if (this.browserPromise) {
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
        '--disable-http2', // Disable HTTP/2 to avoid protocol errors
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

    console.log('Launching browser (using Puppeteer bundled Chromium):', { 
      isProduction, 
      argsCount: browserConfig.args.length
    });

    this.browserPromise = puppeteer.launch(browserConfig)
      .then(browser => {
        console.log('Browser launched successfully');
        this.browser = browser;
        this.browserPromise = null;
        return browser;
      })
      .catch(error => {
        console.error('Failed to launch browser:', error.message);
        this.browserPromise = null;
        throw error;
      });
    
    return await this.browserPromise;
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }


  /**
   * Search jobs from Indeed using Puppeteer (Full interaction)
   */
  async searchJobsNaukari({ role, location, experienceLevel, jobType }) {
    let page;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      
      
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('Navigating to Naukri.com...');
      try {
        await page.goto('https://www.naukri.com/', { 
          waitUntil: 'domcontentloaded', // Less strict than networkidle2
          timeout: 60000 // Increase timeout
        });
        console.log('Page loaded successfully');
      } catch (navError) {
        console.log('Navigation error:', navError.message);
        console.log('⚠️ Naukri.com may be blocking Render.com IP addresses');
        throw new Error('Unable to access Naukri.com from this server. The site may be blocking cloud hosting IPs.');
      }

      let roleQuery = role+" "+jobType
      console.log('Searching for:', { roleQuery, location, experienceLevel });
      
      // Wait for and fill job title field
      console.log('Waiting for job title field...');
      await page.waitForSelector('[placeholder="Enter skills / designations / companies"]', { timeout: 20000 });
      await page.type('[placeholder="Enter skills / designations / companies"]', roleQuery);
      console.log('Job title entered');
      
      if (location && location.toLowerCase() !== 'remote') {
        // Type location and wait for autocomplete suggestions
        console.log('Entering location:', location);
        await page.type('.suggestor-input', location);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Wait for and click the first suggestion
        try {
          await page.waitForSelector('.tuple-wrap .pre-wrap', { timeout: 15000 });
          await page.click('.tuple-wrap b.pre-wrap');
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('Location selected from suggestions');
        } catch (error) {
          console.log('No location suggestion found, continuing with typed value');
        }
      }

      if(experienceLevel) {
        console.log('Setting experience level:', experienceLevel);
        await page.click('.qsbExperience .dropArrowDD');
        await page.click(`#sa-dd-scrollexpereinceDD [index="${experienceLevel}"]`)
      }
      
      console.log('Submitting search...');
      await page.click('.qsb .qsbSubmit');
      
      // Wait for navigation to complete
      console.log('Waiting for navigation to search results...');
      await page.waitForNavigation({ 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Additional wait for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check current URL and page title
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log('After submit - URL:', currentUrl);
      console.log('After submit - Title:', pageTitle);
      
      // Check if there's a captcha or error message
      const pageContent = await page.content();
      if (pageContent.includes('captcha') || pageContent.includes('Captcha')) {
        console.log('⚠️ CAPTCHA DETECTED on the page');
      }
      if (pageContent.includes('Access Denied') || pageContent.includes('blocked')) {
        console.log('⚠️ ACCESS DENIED or BLOCKED');
      }
      
      console.log('Waiting for job listings...');
      try {
        // Try multiple possible selectors
        await Promise.race([
          page.waitForSelector('.styles_job-listing-container__OCfZC', { timeout: 30000 }),
          page.waitForSelector('.srp-jobtuple-wrapper', { timeout: 30000 }),
          page.waitForSelector('[class*="job-listing"]', { timeout: 30000 })
        ]);
        console.log('Job listings loaded');
      } catch (error) {
        console.log('❌ Job listings container not found after 30s wait');
        console.log('Current URL:', currentUrl);
        
        // Try to get body text to see what's on the page
        const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
        console.log('Page content preview:', bodyText);
        throw error;
      }
      
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let allJobs = [];
      let jobIdCounter = 1;
      
      // Loop through 3 pages
      for (let pageNum = 0; pageNum < 3; pageNum++) {
        console.log(`Scraping page ${pageNum + 1}...`);
        
        // Debug: Check what's actually on the page
        const debugInfo = await page.evaluate(() => {
          // Try multiple possible selectors
          const possibleSelectors = [
            '.styles_job-listing-container__OCfZC .srp-jobtuple-wrapper',
            '.srp-jobtuple-wrapper',
            '[class*="job-tuple"]',
            'article',
            '[data-job-id]'
          ];
          
          const counts = {};
          possibleSelectors.forEach(selector => {
            counts[selector] = document.querySelectorAll(selector).length;
          });
          
          // Get a sample of class names
          const allDivs = Array.from(document.querySelectorAll('div[class*="job"]')).slice(0, 5);
          const sampleClasses = allDivs.map(d => d.className);
          
          return { counts, sampleClasses };
        });
        
        console.log('Debug - Selector counts:', debugInfo.counts);
        console.log('Debug - Sample job-related classes:', debugInfo.sampleClasses);
        
        const jobs = await page.evaluate((startId) => {
          // Try the most common selector first, then fallbacks
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
        
        console.log(`Page ${pageNum + 1}: Found ${jobs.length} jobs`);
        allJobs = [...allJobs, ...jobs];
        jobIdCounter += jobs.length;
        
        // Click next button if not on last page
        if (pageNum < 3) {
          try {
            await page.click('.styles_btn-secondary__2AsIP');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await page.evaluate(() => window.scrollBy(0, 1000));
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (error) {
            console.log('No more pages available or next button not found');
            break;
          }
        }
      }
      
      console.log(`Total jobs scraped: ${allJobs.length}`);
      return allJobs;
      
    } catch (error) {
      console.error('Error during scraping:', error.message);
      console.error('Stack trace:', error.stack);
      if (error.message.includes('Could not find Chrome')) {
        console.log('Chrome not available in development. Skipping Indeed scraping.',error.message);
      }
      return [];
    } finally {
      if (page) await page.close();
    }
  }

  /**
   * Aggregate job search from multiple sources using Puppeteer
   * This is the main function - runs interactive scraping
   */
  async searchJobs({ role, designation, experienceLevel, location, jobType }) {
    try {
      // Run scrapers in parallel with timeout
      const [indeedJobs] = await Promise.allSettled([
        this.searchJobsNaukari({ role: role || designation, location, experienceLevel, jobType })
      ]);

      let allJobs = [];

      if (indeedJobs.status === 'fulfilled' && indeedJobs.value.length > 0) {
        allJobs = [...allJobs, ...indeedJobs.value];
      }

      await this.closeBrowser();

      // Filter jobs by location if provided
      if (location && location.trim() !== '') {
        allJobs = allJobs.filter(job => 
          job.location && job.location.toLowerCase().includes(location.toLowerCase())
        );
      }

      return allJobs;

    } catch (error) {
      console.error('Job search error:', error);
      console.error('Error stack:', error.stack);
      await this.closeBrowser();
      throw error; // Re-throw to let controller handle it
    }
  }
}

module.exports = new JobScraperService();
