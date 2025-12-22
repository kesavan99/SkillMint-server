const AIProvider = require('./AIProvider');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini AI Provider implementation
 */
class GeminiProvider extends AIProvider {
  constructor() {
    super();
    this.client = null;
    // Use models from env or default to valid models
    this.models = this.getModelList();
  }

  getModelList() {
    if (process.env.GEMINI_MODEL_FALLBACKS) {
      return process.env.GEMINI_MODEL_FALLBACKS.split(',').map(m => m.trim());
    }
    // Default valid models for Gemini API
    return ['gemini-1.5-flash', 'gemini-pro'];
  }

  getName() {
    return 'Gemini';
  }

  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  }

  getClient() {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in .env');
    }

    if (!this.client) {
      this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    return this.client;
  }

  async generateWithModel(modelName, prompt) {
    const client = this.getClient();
    const model = client.getGenerativeModel({ model: modelName });

    const generationConfig = {
      temperature: 0.1,
      topK: 1,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: "application/json"
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig
    });

    const response = await result.response;
    let text = response.text();

    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    // Clean up the response
    text = text.trim();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    text = text.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    try {
      return JSON.parse(text);
    } catch (parseError) {
      throw new Error('Failed to parse Gemini response as JSON: ' + parseError.message);
    }
  }

  isRateLimitError(error) {
    if (!error) return false;
    const message = error?.message?.toLowerCase() || '';
    return (
      message.includes('rate limit') ||
      message.includes('quota') ||
      message.includes('429') ||
      message.includes('resource_exhausted') ||
      error.status === 429
    );
  }

  async parseResume(resumeText) {
    const prompt = `You are an expert resume parser. Extract information from the resume text and return a valid JSON object.

CRITICAL RULES:
1. Return ONLY valid JSON - no explanations, no markdown, no code blocks
2. Use the EXACT structure shown below
3. If a field is missing, use empty string "" or empty array []
4. Never skip or add fields to the structure

Required JSON Structure:
{
  "personalInfo": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "portfolio": ""
  },
  "summary": "",
  "education": [
    {
      "degree": "",
      "institution": "",
      "year": "",
      "gpa": ""
    }
  ],
  "experience": [
    {
      "title": "",
      "company": "",
      "duration": "",
      "description": ""
    }
  ],
  "skills": [],
  "projects": [
    {
      "name": "",
      "description": "",
      "technologies": ""
    }
  ],
  "certifications": []
}

Resume Text to Parse:
${resumeText}

Extract all information and return the JSON object with filled values:`;

    let lastError = null;

    for (const modelName of this.models) {
      try {
        const result = await this.generateWithModel(modelName, prompt);
        return result;
      } catch (error) {
        lastError = error;

        if (this.isRateLimitError(error)) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        // Try next model for other errors too
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
    }

    throw lastError || new Error('All Gemini models failed');
  }
}

module.exports = GeminiProvider;
