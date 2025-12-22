const AIProviderFactory = require('./ai/AIProviderFactory');

/**
 * Parse resume text using Gemini AI
 * @param {string} resumeText - Extracted text from PDF
 * @returns {Promise<Object>} - Structured resume data
 */
async function parseResumeWithAI(resumeText) {
  try {
    // Get the configured AI provider from factory
    const provider = AIProviderFactory.getProvider();
    
    const parsedData = await provider.parseResume(resumeText);
    
    return parsedData;
  } catch (error) {
    throw new Error(`Failed to parse resume with AI: ${error.message}`);
  }
}

module.exports = {
  parseResumeWithAI
};
