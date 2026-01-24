/**
 * ATS Configuration - Weights and Thresholds
 */

const ATSWeights = {
  // Role-based weights
  SOFTWARE_ENGINEER: {
    skills: 0.35,
    experience: 0.30,
    projects: 0.15,
    keywords: 0.10,
    summary: 0.05,
    education: 0.05
  },
  
  FRESHER_INTERN: {
    skills: 0.30,
    projects: 0.25,
    education: 0.20,
    keywords: 0.10,
    summary: 0.10,
    experience: 0.05
  },
  
  MANAGER_LEAD: {
    experience: 0.40,
    keywords: 0.20,
    skills: 0.20,
    summary: 0.10,
    education: 0.10,
    projects: 0.00
  },
  
  DEFAULT: {
    skills: 0.35,
    experience: 0.30,
    projects: 0.15,
    keywords: 0.10,
    summary: 0.05,
    education: 0.05
  },
  
  /**
   * Get weights based on role type
   * @param {string} roleType - Role type
   * @returns {Object} Weights for the role
   */
  getWeights(roleType) {
    const weightsMap = {
      'software_engineer': this.SOFTWARE_ENGINEER,
      'developer': this.SOFTWARE_ENGINEER,
      'engineer': this.SOFTWARE_ENGINEER,
      'fresher': this.FRESHER_INTERN,
      'intern': this.FRESHER_INTERN,
      'entry_level': this.FRESHER_INTERN,
      'manager': this.MANAGER_LEAD,
      'lead': this.MANAGER_LEAD,
      'senior': this.SOFTWARE_ENGINEER,
      'default': this.DEFAULT
    };
    
    return weightsMap[roleType?.toLowerCase()] || this.DEFAULT;
  }
};

const HardFilterThresholds = {
  // 80% of required experience
  MIN_EXPERIENCE_MATCH_RATIO: 0.8,
  
  // Keywords indicating flexible location
  LOCATION_FLEXIBLE_KEYWORDS: ['remote', 'anywhere', 'flexible', 'hybrid', 'work from home', 'wfh'],
  
  // Keywords indicating work authorization
  WORK_AUTH_KEYWORDS: [
    'citizen', 'authorized', 'visa', 'green card',
    'work permit', 'eligible to work', 'authorized to work'
  ]
};

// Education level hierarchy
const DEGREE_LEVELS = {
  'high school': 1,
  'diploma': 2,
  'associate': 2,
  'bachelor': 3,
  'bachelors': 3,
  'b.tech': 3,
  'b.e': 3,
  'bsc': 3,
  'bca': 3,
  'master': 4,
  'masters': 4,
  'm.tech': 4,
  'msc': 4,
  'mca': 4,
  'mba': 4,
  'phd': 5,
  'doctorate': 5
};

module.exports = {
  ATSWeights,
  HardFilterThresholds,
  DEGREE_LEVELS
};
