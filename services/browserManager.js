const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Browser Manager Service
 * Manages a single Puppeteer browser instance for the entire application
 * Browser launches once on server startup and stays alive
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    this.isInitializing = false;
  }

  /**
   * Initialize browser once on server startup
   * @returns {Promise<Browser>}
   */
  async initialize() {
    if (this.browser) {
      return this.browser;
    }

    if (this.isInitializing) {
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.browser;
    }

    try {
      this.isInitializing = true;

      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--single-process', // Important for Render.com
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      };

      // Puppeteer will use bundled Chromium (installed via postinstall script)
      this.browser = await puppeteer.launch(launchOptions);

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        this.browser = null;
      });

      return this.browser;

    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
      this.browser = null;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Get the browser instance
   * @returns {Promise<Browser>}
   */
  async getBrowser() {
    if (!this.browser) {
      return await this.initialize();
    }
    return this.browser;
  }

  /**
   * Close the browser (only on server shutdown)
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get browser status
   */
  getStatus() {
    return {
      isInitialized: this.browser !== null,
      isConnected: this.browser ? this.browser.isConnected() : false
    };
  }
}

// Singleton instance
const browserManager = new BrowserManager();

module.exports = browserManager;
