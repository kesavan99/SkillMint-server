const { analyzeResumeWithAI } = require('../../services/aiAnalysisService');

/**
 * Analyze resume against job role and experience level
 */
async function analyzeResume(req, res) {
  try {
    const { resumeData, jobRole, experienceLevel } = req.body;

    if (!resumeData || !jobRole || !experienceLevel) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please provide resumeData, jobRole, and experienceLevel'
      });
    }

    const analysis = await analyzeResumeWithAI(resumeData, jobRole, experienceLevel);

    res.json(analysis);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to analyze resume',
      message: error.message
    });
  }
}

module.exports = {
  analyzeResume
};
