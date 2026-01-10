const { join } = require('path');

/**
 * Puppeteer configuration for Render.com deployment
 * Uses local cache directory to avoid permission issues
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
