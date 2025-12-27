const { join } = require('path');

/**
 * Puppeteer configuration for Render.com
 * Specifies custom cache directory for browser downloads
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
