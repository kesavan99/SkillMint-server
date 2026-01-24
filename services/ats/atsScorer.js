/**
 * ATS Scoring Service - Core business logic for resume analysis
 * Node.js implementation (migrated from Python)
 */

const TextProcessor = require('./textProcessor');
const SkillMatcher = require('./skillMatcher');
const { ATSWeights, HardFilterThresholds, DEGREE_LEVELS } = require('./atsConfig');

class ATSScorer {
  constructor() {
    this.textProcessor = TextProcessor;
    this.skillMatcher = new SkillMatcher();
  }

  /**
   * Perform complete ATS analysis
   * @param {Object} resume - Resume input data
   * @param {Object} jobDescription - Job description input data
   * @param {Object} customWeights - Optional custom scoring weights
   * @returns {Object} Complete ATS analysis response
   */
  analyze(resume, jobDescription, customWeights = null) {
    // Stage 1: Hard Filters
    const hardFilters = this._evaluateHardFilters(resume, jobDescription);
    
    // Stage 2: Relevance Scoring (only if hard filters passed)
    let relevanceScore = null;
    let overallMatch = 0;
    
    if (hardFilters.passed) {
      relevanceScore = this._calculateRelevanceScore(resume, jobDescription, customWeights);
      overallMatch = relevanceScore.weightedTotal;
    }
    
    // Generate skill analysis
    const skillAnalysis = this.skillMatcher.matchSkills(
      resume.skills || [],
      jobDescription.requiredSkills || [],
      jobDescription.preferredSkills || []
    );
    
    const matchedSkills = skillAnalysis.matchedRequired;
    const missingSkills = skillAnalysis.missingRequired;
    
    // Generate feedback and recommendations
    const feedback = this._generateFeedback(hardFilters, relevanceScore, skillAnalysis, resume, jobDescription);
    const recommendations = this._generateRecommendations(skillAnalysis, relevanceScore, resume, jobDescription);
    
    return {
      hardFilters,
      relevanceScore,
      overallMatchPercentage: Math.round(overallMatch * 100) / 100,
      matchedSkills,
      missingSkills,
      skillAnalysis,
      feedback,
      recommendations,
      analysisTimestamp: new Date().toISOString(),
      roleType: jobDescription.roleType || 'default'
    };
  }

  /**
   * Stage 1: Evaluate hard filters (Boolean pass/fail)
   * @param {Object} resume - Resume data
   * @param {Object} jobDescription - Job description data
   * @returns {Object} Hard filter results
   */
  _evaluateHardFilters(resume, jobDescription) {
    const failureReasons = [];
    
    // 1. Location Check - Disabled (always pass)
    const locationMatch = true;
    
    // 2. Work Authorization Check
    const workAuthMatch = this._checkWorkAuthorization(
      resume.workAuthorization,
      jobDescription.description || jobDescription.jobDescription || ''
    );
    if (!workAuthMatch) {
      failureReasons.push('Work authorization requirement not clearly stated');
    }
    
    // 3. Experience Check
    const experienceMatch = this._checkExperience(
      resume.yearsOfExperience || 0,
      jobDescription.minExperience || 0,
      jobDescription.maxExperience
    );
    if (!experienceMatch) {
      failureReasons.push(
        `Experience requirement not met: Requires ${jobDescription.minExperience}+ years, resume shows ${resume.yearsOfExperience || 0} years`
      );
    }
    
    // 4. Education Check
    const educationMatch = this._checkEducation(
      resume.highestDegree,
      resume.education || [],
      jobDescription.requiredEducation
    );
    if (!educationMatch) {
      failureReasons.push(`Education requirement not met: ${jobDescription.requiredEducation}`);
    }
    
    const passed = locationMatch && workAuthMatch && experienceMatch && educationMatch;
    
    return {
      passed,
      locationMatch,
      workAuthorizationMatch: workAuthMatch,
      experienceMatch,
      educationMatch,
      failureReasons
    };
  }

  /**
   * Check if work authorization requirement is met
   */
  _checkWorkAuthorization(resumeWorkAuth, jobDescriptionText) {
    // If job doesn't mention work auth, pass
    const jobRequiresAuth = HardFilterThresholds.WORK_AUTH_KEYWORDS.some(
      keyword => jobDescriptionText.toLowerCase().includes(keyword)
    );
    
    if (!jobRequiresAuth) return true;
    
    // If job requires auth, check if resume mentions it
    if (!resumeWorkAuth) return false;
    
    return HardFilterThresholds.WORK_AUTH_KEYWORDS.some(
      keyword => resumeWorkAuth.toLowerCase().includes(keyword)
    );
  }

  /**
   * Check if experience requirement is met
   */
  _checkExperience(resumeExperience, minRequired, maxRequired = null) {
    // For entry-level positions (0-1 years), be more lenient
    if (minRequired <= 1) return true;
    
    // Allow 80% of required experience
    const minThreshold = minRequired * HardFilterThresholds.MIN_EXPERIENCE_MATCH_RATIO;
    
    if (resumeExperience < minThreshold) return false;
    
    return true;
  }

  /**
   * Check if education requirement is met
   */
  _checkEducation(highestDegree, educationList, requiredEducation) {
    if (!requiredEducation) return true;
    
    if (!highestDegree && (!educationList || educationList.length === 0)) return false;
    
    // Find required level
    let requiredLevel = 0;
    const reqLower = requiredEducation.toLowerCase();
    for (const [degree, level] of Object.entries(DEGREE_LEVELS)) {
      if (reqLower.includes(degree)) {
        requiredLevel = level;
        break;
      }
    }
    
    if (requiredLevel === 0) return true; // No specific degree required
    
    // Find candidate's level
    let candidateLevel = 0;
    
    if (highestDegree) {
      const degLower = highestDegree.toLowerCase();
      for (const [degree, level] of Object.entries(DEGREE_LEVELS)) {
        if (degLower.includes(degree)) {
          candidateLevel = Math.max(candidateLevel, level);
        }
      }
    }
    
    // Check all education entries
    for (const edu of educationList) {
      const eduLower = (typeof edu === 'string' ? edu : edu.degree || '').toLowerCase();
      for (const [degree, level] of Object.entries(DEGREE_LEVELS)) {
        if (eduLower.includes(degree)) {
          candidateLevel = Math.max(candidateLevel, level);
        }
      }
    }
    
    return candidateLevel >= requiredLevel;
  }

  /**
   * Stage 2: Calculate weighted relevance scores
   */
  _calculateRelevanceScore(resume, jobDescription, customWeights = null) {
    const weights = customWeights || ATSWeights.getWeights(jobDescription.roleType);
    
    // Calculate individual scores
    const skillsScore = this._scoreSkills(resume, jobDescription);
    const experienceScore = this._scoreExperience(resume, jobDescription);
    const projectsScore = this._scoreProjects(resume, jobDescription);
    const keywordsScore = this._scoreKeywords(resume, jobDescription);
    const summaryScore = this._scoreSummary(resume, jobDescription);
    const educationScore = this._scoreEducation(resume, jobDescription);
    
    // Calculate weighted total
    const weightedTotal = (
      skillsScore * weights.skills +
      experienceScore * weights.experience +
      projectsScore * weights.projects +
      keywordsScore * weights.keywords +
      summaryScore * weights.summary +
      educationScore * weights.education
    );
    
    return {
      skillsScore: Math.round(skillsScore * 100) / 100,
      experienceScore: Math.round(experienceScore * 100) / 100,
      projectsScore: Math.round(projectsScore * 100) / 100,
      keywordsScore: Math.round(keywordsScore * 100) / 100,
      summaryScore: Math.round(summaryScore * 100) / 100,
      educationScore: Math.round(educationScore * 100) / 100,
      weightedTotal: Math.round(weightedTotal * 100) / 100,
      weightsUsed: weights
    };
  }

  /**
   * Score skills match (0-100)
   */
  _scoreSkills(resume, jobDescription) {
    const skillAnalysis = this.skillMatcher.matchSkills(
      resume.skills || [],
      jobDescription.requiredSkills || [],
      jobDescription.preferredSkills || []
    );
    
    return skillAnalysis.overallSkillScore;
  }

  /**
   * Score experience relevance (0-100)
   */
  _scoreExperience(resume, jobDescription) {
    let score = 0;
    
    // 1. Years of experience match (40%)
    const minExp = Math.max(jobDescription.minExperience || 1, 1);
    const expRatio = (resume.yearsOfExperience || 0) / minExp;
    const expScore = Math.min(expRatio * 100, 100);
    score += expScore * 0.4;
    
    // 2. Experience description relevance (60%)
    const combinedExperience = (resume.workExperience || []).join(' ');
    const jobDesc = jobDescription.description || jobDescription.jobDescription || '';
    const relevance = this.textProcessor.calculateTextSimilarity(combinedExperience, jobDesc);
    score += relevance * 0.6;
    
    return Math.min(score, 100);
  }

  /**
   * Score projects match (0-100)
   */
  _scoreProjects(resume, jobDescription) {
    if (!resume.projects || resume.projects.length === 0) return 0;
    
    const combinedProjects = resume.projects.join(' ');
    const jobDesc = jobDescription.description || jobDescription.jobDescription || '';
    
    // Check project relevance
    const relevance = this.textProcessor.calculateTextSimilarity(combinedProjects, jobDesc);
    
    // Bonus for having projects
    const projectBonus = Math.min(resume.projects.length * 5, 20);
    
    return Math.min(relevance + projectBonus, 100);
  }

  /**
   * Score keyword match (0-100)
   */
  _scoreKeywords(resume, jobDescription) {
    // Combine all resume text
    const resumeText = [
      (resume.skills || []).join(' '),
      (resume.workExperience || []).join(' '),
      (resume.projects || []).join(' '),
      resume.summary || ''
    ].join(' ');
    
    const jobDesc = jobDescription.description || jobDescription.jobDescription || '';
    
    // Calculate keyword overlap
    const overlap = this.textProcessor.calculateKeywordOverlap(resumeText, jobDesc);
    
    return Math.min(overlap, 100);
  }

  /**
   * Score summary/profile relevance (0-100)
   */
  _scoreSummary(resume, jobDescription) {
    if (!resume.summary) return 50; // Neutral score if no summary
    
    const jobDesc = jobDescription.description || jobDescription.jobDescription || '';
    const relevance = this.textProcessor.calculateTextSimilarity(resume.summary, jobDesc);
    
    return relevance;
  }

  /**
   * Score education match (0-100)
   */
  _scoreEducation(resume, jobDescription) {
    if (!jobDescription.requiredEducation) return 100;
    
    if (!resume.education && !resume.highestDegree) return 0;
    
    if (this._checkEducation(resume.highestDegree, resume.education || [], jobDescription.requiredEducation)) {
      return 100;
    }
    
    return 50;
  }

  /**
   * Generate comprehensive feedback
   */
  _generateFeedback(hardFilters, relevanceScore, skillAnalysis, resume, jobDescription) {
    if (!hardFilters.passed) {
      return `Resume did not pass initial screening. Issues: ${hardFilters.failureReasons.join(', ')}`;
    }
    
    if (!relevanceScore) {
      return 'Unable to calculate relevance score.';
    }
    
    const overallScore = relevanceScore.weightedTotal;
    let feedback = '';
    
    if (overallScore >= 80) {
      feedback = '🎯 Excellent match! Your profile aligns very well with the job requirements. ';
    } else if (overallScore >= 60) {
      feedback = '✅ Good match! You meet most of the requirements with room for improvement. ';
    } else if (overallScore >= 40) {
      feedback = '⚠️ Moderate match. Consider strengthening key areas to improve your chances. ';
    } else {
      feedback = '❌ Limited match. Significant gaps exist between your profile and requirements. ';
    }
    
    // Add specific insights
    if (relevanceScore.skillsScore < 70) {
      feedback += `Your skills match score is ${relevanceScore.skillsScore.toFixed(0)}%. `;
    }
    
    if (skillAnalysis.totalMissing > 0) {
      feedback += `You're missing ${skillAnalysis.totalMissing} required/preferred skills. `;
    }
    
    if (relevanceScore.experienceScore < 70) {
      feedback += 'Consider highlighting more relevant experience. ';
    }
    
    return feedback;
  }

  /**
   * Generate actionable recommendations
   */
  _generateRecommendations(skillAnalysis, relevanceScore, resume, jobDescription) {
    const recommendations = [];
    
    // Skill recommendations
    if (skillAnalysis.missingRequired && skillAnalysis.missingRequired.length > 0) {
      const topMissing = skillAnalysis.missingRequired.slice(0, 3);
      recommendations.push(`🎯 Acquire or highlight these critical skills: ${topMissing.join(', ')}`);
    }
    
    if (relevanceScore) {
      // Experience recommendations
      if (relevanceScore.experienceScore < 70) {
        recommendations.push('📝 Emphasize experience more relevant to this role in your resume');
      }
      
      // Projects recommendations
      if (relevanceScore.projectsScore < 50 && jobDescription.roleType !== 'manager') {
        recommendations.push('💼 Add relevant projects that demonstrate required skills');
      }
      
      // Keywords recommendations
      if (relevanceScore.keywordsScore < 60) {
        recommendations.push('🔑 Include more industry-specific keywords from the job description');
      }
      
      // Summary recommendations
      if (!resume.summary || relevanceScore.summaryScore < 50) {
        recommendations.push('✍️ Write or improve your professional summary to align with this role');
      }
    }
    
    // Certifications recommendations
    if ((!resume.certifications || resume.certifications.length === 0) && 
        skillAnalysis.missingRequired && skillAnalysis.missingRequired.length > 0) {
      recommendations.push('🏅 Consider getting certifications in missing skill areas');
    }
    
    return recommendations.slice(0, 5);
  }

  /**
   * Quick ATS score calculation (simplified version for job search)
   * @param {Object} resume - Resume data
   * @param {Object} job - Job data from search
   * @returns {Object} Quick ATS score
   */
  quickScore(resume, job) {
    // Extract skills from job description if not provided
    const jobSkills = job.requiredSkills || 
      this.skillMatcher.extractSkillsFromText(job.description || job.jobDescription || '');
    
    const resumeSkills = resume.skills || [];
    
    // Quick skill match
    const skillAnalysis = this.skillMatcher.matchSkills(resumeSkills, jobSkills, []);
    
    // Quick keyword match
    const resumeText = [
      resumeSkills.join(' '),
      (resume.workExperience || []).join(' '),
      resume.summary || ''
    ].join(' ');
    
    const jobDesc = job.description || job.jobDescription || '';
    const keywordMatch = this.textProcessor.calculateKeywordOverlap(resumeText, jobDesc);
    
    // Calculate quick score (60% skills, 40% keywords)
    const quickScore = (skillAnalysis.overallSkillScore * 0.6) + (keywordMatch * 0.4);
    
    return {
      score: Math.round(quickScore * 100) / 100,
      matchedSkills: skillAnalysis.matchedRequired,
      missingSkills: skillAnalysis.missingRequired,
      skillMatchPercentage: skillAnalysis.requiredMatchPercentage,
      keywordMatchPercentage: Math.round(keywordMatch * 100) / 100
    };
  }
}

module.exports = ATSScorer;
