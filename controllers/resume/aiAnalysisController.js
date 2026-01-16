const { analyzeResumeWithAI } = require('../../services/aiAnalysisService');
const User = require('../../models/schemas/userSchema');

/**
 * Analyze resume against job role and experience level
 */
async function analyzeResume(req, res) {
  try {
    const { resumeData, jobRole, experienceLevel } = req.body;
    const userId = req.user?.userId; // From auth middleware

    if (!resumeData || !jobRole || !experienceLevel) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please provide resumeData, jobRole, and experienceLevel'
      });
    }

    // Check and deduct AI limit if user is authenticated
    if (userId) {
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Unable to verify user account'
        });
      }

      // Check if aiLimit needs to be reset (new day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastResetDate = user.aiLimitResetDate ? new Date(user.aiLimitResetDate) : null;
      if (lastResetDate) {
        lastResetDate.setHours(0, 0, 0, 0);
      }
      
      // Reset aiLimit to 3 if it's a new day
      if (!lastResetDate || lastResetDate.getTime() < today.getTime()) {
        user.aiLimit = 3;
        user.aiLimitResetDate = new Date();
      }

      // Check if user has remaining AI analysis quota
      const currentAiLimit = user.aiLimit !== undefined ? user.aiLimit : 3;
      if (currentAiLimit <= 0) {
        return res.status(403).json({
          error: 'AI analysis limit exceeded',
          message: 'You have reached your daily limit of 3 AI analyses. Please try again tomorrow.',
          aiLimit: 0
        });
      }

      // Deduct 1 from aiLimit
      user.aiLimit = currentAiLimit - 1;
      await user.save();

      const analysis = await analyzeResumeWithAI(resumeData, jobRole, experienceLevel);

      // Include remaining aiLimit in response
      res.json({
        ...analysis,
        aiLimit: user.aiLimit
      });
    } else {
      // For unauthenticated users, just perform the analysis
      const analysis = await analyzeResumeWithAI(resumeData, jobRole, experienceLevel);
      res.json(analysis);
    }
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
