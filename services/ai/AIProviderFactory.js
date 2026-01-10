const GeminiProvider = require('./GeminiProvider');

/**
 * Factory to create the appropriate AI provider based on environment configuration
 * Uses Gemini as the AI provider
 */
class AIProviderFactory {
  /**
   * Get the configured AI provider
   * @returns {AIProvider} - Configured AI provider instance
   */
  static getProvider() {
    const gemini = new GeminiProvider();
    if (gemini.isConfigured()) {
      return gemini;
    }

    throw new Error(
      'Gemini AI provider not configured. Please set GEMINI_API_KEY in .env'
    );
  }

  /**
   * Get all available providers
   * @returns {AIProvider[]} - Array of configured providers
   */
  static getAvailableProviders() {
    const providers = [];
    
    const gemini = new GeminiProvider();
    if (gemini.isConfigured()) {
      providers.push(gemini);
    }

    return providers;
  }

  /**
   * Check if any AI provider is configured
   * @returns {boolean}
   */
  static hasConfiguredProvider() {
    return this.getAvailableProviders().length > 0;
  }
}

module.exports = AIProviderFactory;
