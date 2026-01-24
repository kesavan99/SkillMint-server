/**
 * ATS Analysis Controller
 * Handles resume ATS scoring and job matching without using external AI APIs
 */

const { ATSScorer, SkillMatcher } = require('../../services/ats');

const atsScorer = new ATSScorer();
const skillMatcher = new SkillMatcher();

/**
 * Full ATS Analysis
 * POST /api/ats/analyze
 */
const analyzeResume = async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;

    // Validate required fields
    if (!resume) {
      return res.status(400).json({
        success: false,
        message: 'Resume data is required'
      });
    }

    if (!jobDescription) {
      return res.status(400).json({
        success: false,
        message: 'Job description is required'
      });
    }

    // Perform ATS analysis
    const analysis = atsScorer.analyze(resume, jobDescription);

    res.status(200).json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('ATS Analysis Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform ATS analysis',
      error: error.message
    });
  }
};

/**
 * Quick ATS Score for Job Search
 * POST /api/ats/quick-score
 */
const quickScore = async (req, res) => {
  try {
    const { resume, job } = req.body;

    if (!resume || !job) {
      return res.status(400).json({
        success: false,
        message: 'Resume and job data are required'
      });
    }

    const score = atsScorer.quickScore(resume, job);

    res.status(200).json({
      success: true,
      data: score
    });
  } catch (error) {
    console.error('Quick Score Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate quick score',
      error: error.message
    });
  }
};

/**
 * Batch Quick Score for Multiple Jobs
 * POST /api/ats/batch-score
 */
const batchScore = async (req, res) => {
  try {
    const { resume, jobs } = req.body;

    if (!resume || !jobs || !Array.isArray(jobs)) {
      return res.status(400).json({
        success: false,
        message: 'Resume and jobs array are required'
      });
    }

    // Limit batch size to prevent overload
    const maxBatchSize = 50;
    const jobsToScore = jobs.slice(0, maxBatchSize);

    const scores = jobsToScore.map((job, index) => {
      try {
        const score = atsScorer.quickScore(resume, job);
        return {
          jobIndex: index,
          jobId: job.id || job._id || index,
          jobTitle: job.title || job.jobTitle || 'Unknown',
          company: job.company || job.employerName || 'Unknown',
          ...score
        };
      } catch (err) {
        return {
          jobIndex: index,
          jobId: job.id || job._id || index,
          jobTitle: job.title || job.jobTitle || 'Unknown',
          error: err.message,
          score: 0
        };
      }
    });

    // Sort by score descending
    scores.sort((a, b) => (b.score || 0) - (a.score || 0));

    res.status(200).json({
      success: true,
      data: {
        totalJobs: jobs.length,
        scoredJobs: scores.length,
        scores
      }
    });
  } catch (error) {
    console.error('Batch Score Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate batch scores',
      error: error.message
    });
  }
};

/**
 * Extract Skills from Text
 * POST /api/ats/extract-skills
 */
const extractSkills = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required'
      });
    }

    const skills = skillMatcher.extractSkillsFromText(text);

    res.status(200).json({
      success: true,
      data: {
        skills,
        count: skills.length
      }
    });
  } catch (error) {
    console.error('Extract Skills Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract skills',
      error: error.message
    });
  }
};

/**
 * Match Skills
 * POST /api/ats/match-skills
 */
const matchSkills = async (req, res) => {
  try {
    const { resumeSkills, requiredSkills, preferredSkills } = req.body;

    if (!resumeSkills || !requiredSkills) {
      return res.status(400).json({
        success: false,
        message: 'Resume skills and required skills are required'
      });
    }

    const analysis = skillMatcher.matchSkills(
      resumeSkills,
      requiredSkills,
      preferredSkills || []
    );

    res.status(200).json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Match Skills Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to match skills',
      error: error.message
    });
  }
};

module.exports = {
  analyzeResume,
  quickScore,
  batchScore,
  extractSkills,
  matchSkills
};
