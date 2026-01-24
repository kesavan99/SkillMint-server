/**
 * Text processing utilities for resume and job description analysis
 */

class TextProcessor {
  /**
   * Clean and normalize text
   * @param {string} text - Input text
   * @returns {string} Cleaned text
   */
  static cleanText(text) {
    if (!text) return '';
    
    let cleaned = text.toLowerCase();
    cleaned = cleaned.replace(/[^a-z0-9\s\+\#\.]/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    return cleaned.trim();
  }

  /**
   * Common stopwords to filter out
   */
  static STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'also', 'now', 'here', 'there', 'then', 'once', 'any', 'about', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'under', 'again', 'further', 'while', 'our', 'your', 'their', 'its',
    'my', 'his', 'her', 'am', 'being', 'having', 'doing', 'work', 'working',
    'experience', 'using', 'used', 'including', 'include', 'includes'
  ]);

  /**
   * Extract keywords from text
   * @param {string} text - Input text
   * @param {number} minLength - Minimum keyword length
   * @returns {string[]} Array of keywords
   */
  static extractKeywords(text, minLength = 2) {
    if (!text) return [];
    
    const cleaned = TextProcessor.cleanText(text);
    const words = cleaned.split(' ');
    
    const keywords = words.filter(
      word => word.length >= minLength && !TextProcessor.STOPWORDS.has(word)
    );
    
    return keywords;
  }

  /**
   * Calculate keyword overlap between two texts
   * @param {string} text1 - First text (resume)
   * @param {string} text2 - Second text (job description)
   * @returns {number} Overlap percentage (0-100)
   */
  static calculateKeywordOverlap(text1, text2) {
    const keywords1 = new Set(TextProcessor.extractKeywords(text1));
    const keywords2 = new Set(TextProcessor.extractKeywords(text2));
    
    if (keywords2.size === 0) return 0;
    
    let overlap = 0;
    for (const keyword of keywords2) {
      if (keywords1.has(keyword)) {
        overlap++;
      }
    }
    
    return (overlap / keywords2.size) * 100;
  }

  /**
   * Calculate text similarity using Jaccard similarity
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-100)
   */
  static calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const keywords1 = new Set(TextProcessor.extractKeywords(text1));
    const keywords2 = new Set(TextProcessor.extractKeywords(text2));
    
    if (keywords1.size === 0 || keywords2.size === 0) return 0;
    
    // Calculate intersection
    let intersection = 0;
    for (const keyword of keywords1) {
      if (keywords2.has(keyword)) {
        intersection++;
      }
    }
    
    // Calculate union
    const union = new Set([...keywords1, ...keywords2]).size;
    
    return union > 0 ? (intersection / union) * 100 : 0;
  }

  /**
   * Extract year values from text
   * @param {string} text - Input text
   * @returns {number[]} Array of year values
   */
  static extractYearsFromText(text) {
    if (!text) return [];
    
    const pattern = /(\d+\.?\d*)\s*(?:\+)?\s*(?:years?|yrs?)/gi;
    const matches = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      matches.push(parseFloat(match[1]));
    }
    
    return matches;
  }

  /**
   * Skill normalization map
   */
  static SKILL_MAP = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'k8s': 'kubernetes',
    'aws': 'amazon web services',
    'gcp': 'google cloud platform',
    'ml': 'machine learning',
    'ai': 'artificial intelligence',
    'ci/cd': 'continuous integration continuous deployment',
    'api': 'application programming interface'
  };

  /**
   * Normalize skill name for better matching
   * @param {string} skill - Skill name
   * @returns {string} Normalized skill
   */
  static normalizeSkill(skill) {
    if (!skill) return '';
    
    const normalized = skill.toLowerCase().trim();
    return TextProcessor.SKILL_MAP[normalized] || normalized;
  }

  /**
   * Extract technical terms from text
   * @param {string} text - Input text
   * @returns {string[]} Array of technical terms
   */
  static extractTechnicalTerms(text) {
    if (!text) return [];
    
    const terms = new Set();
    
    // Pattern for acronyms (e.g., AWS, API)
    const acronymPattern = /\b[A-Z]{2,}\b/g;
    let match;
    while ((match = acronymPattern.exec(text)) !== null) {
      terms.add(match[0].toLowerCase());
    }
    
    // Pattern for versioned technologies (e.g., node.js, vue.js)
    const versionedPattern = /\b\w+\.\w+\b/g;
    while ((match = versionedPattern.exec(text)) !== null) {
      terms.add(match[0].toLowerCase());
    }
    
    // Pattern for C++ style names
    const cppPattern = /\b\w+\+\+\b/g;
    while ((match = cppPattern.exec(text)) !== null) {
      terms.add(match[0].toLowerCase());
    }
    
    // Pattern for C# style names
    const csharpPattern = /\b\w+#\b/g;
    while ((match = csharpPattern.exec(text)) !== null) {
      terms.add(match[0].toLowerCase());
    }
    
    return Array.from(terms);
  }
}

module.exports = TextProcessor;
