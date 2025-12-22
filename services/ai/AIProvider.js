/**
 * Base class for AI providers
 * All AI providers must implement this interface
 */
class AIProvider {
  /**
   * Parse resume text into structured JSON
   * @param {string} resumeText - Raw text extracted from resume
   * @returns {Promise<Object>} - Structured resume data
   */
  async parseResume(resumeText) {
    throw new Error('parseResume() must be implemented by subclass');
  }

  /**
   * Get the name of the AI provider
   * @returns {string} - Provider name
   */
  getName() {
    throw new Error('getName() must be implemented by subclass');
  }

  /**
   * Check if the provider is configured and ready to use
   * @returns {boolean} - True if configured
   */
  isConfigured() {
    throw new Error('isConfigured() must be implemented by subclass');
  }
}

module.exports = AIProvider;
