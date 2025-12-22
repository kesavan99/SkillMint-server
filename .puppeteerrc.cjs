const {join} = require('path');

/**
 * Puppeteer configuration for Render.com compatibility
 * This ensures Puppeteer doesn't try to download Chrome during npm install
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
