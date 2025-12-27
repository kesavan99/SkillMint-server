const browserManager = require('./browserManager');

/**
 * Tab Manager Service
 * Manages one tab per user (identified by JWT userId)
 * Each user gets a dedicated tab for all their job searches
 */
class TabManager {
  constructor() {
    // Map: userId -> { page, lastUsed }
    this.userTabs = new Map();
    
    // Cleanup inactive tabs every 30 minutes
    this.cleanupInterval = setInterval(() => this.cleanupInactiveTabs(), 30 * 60 * 1000);
  }

  /**
   * Create a new tab for a user during login
   * @param {string} userId - User ID from JWT
   * @returns {Promise<Page>}
   */
  async createUserTab(userId) {
    try {

      // Close existing tab if any
      await this.closeUserTab(userId);

      const browser = await browserManager.getBrowser();
      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Set realistic user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
      );

      // Store the tab
      this.userTabs.set(userId, {
        page: page,
        lastUsed: Date.now()
      });

      return page;

    } catch (error) {
      console.error(`❌ Failed to create tab for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's existing tab or create a new one
   * @param {string} userId - User ID from JWT
   * @returns {Promise<Page>}
   */
  async getUserTab(userId) {
    const userTab = this.userTabs.get(userId);

    if (userTab && userTab.page) {
      try {
        // Verify the page is still open
        await userTab.page.evaluate(() => true);
        
        // Update last used timestamp
        userTab.lastUsed = Date.now();
        
        return userTab.page;
      } catch (error) {
        this.userTabs.delete(userId);
      }
    }

    // Create new tab if doesn't exist or was closed
    return await this.createUserTab(userId);
  }

  /**
   * Close user's tab during logout
   * @param {string} userId - User ID from JWT
   */
  async closeUserTab(userId) {
    const userTab = this.userTabs.get(userId);

    if (userTab && userTab.page) {
      try {
        await userTab.page.close();
        this.userTabs.delete(userId);
      } catch (error) {
        console.error(`❌ Error closing tab for user ${userId}:`, error);
        this.userTabs.delete(userId);
      }
    }
  }

  /**
   * Cleanup inactive tabs (not used for >1 hour)
   */
  async cleanupInactiveTabs() {
    const now = Date.now();
    const maxInactiveTime = 60 * 60 * 1000; // 1 hour

    for (const [userId, userTab] of this.userTabs.entries()) {
      if (now - userTab.lastUsed > maxInactiveTime) {
        await this.closeUserTab(userId);
      }
    }
  }

  /**
   * Close all tabs (server shutdown)
   */
  async closeAllTabs() {

    const closePromises = [];
    for (const [userId] of this.userTabs.entries()) {
      closePromises.push(this.closeUserTab(userId));
    }
    
    await Promise.all(closePromises);
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get manager statistics
   */
  getStats() {
    return {
      activeTabs: this.userTabs.size,
      users: Array.from(this.userTabs.keys()).map(id => id.substring(0, 8))
    };
  }
}

// Singleton instance
const tabManager = new TabManager();

module.exports = tabManager;
