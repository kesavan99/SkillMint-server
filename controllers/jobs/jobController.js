const jSearchService = require('../../services/jSearchService');
const axios = require('axios');
const User = require('../../models/schemas/userSchema');
const { v4: uuidv4 } = require('uuid');


const ATS_API_URL = 'https://ats-analysis.onrender.com/api/v1';
// const ATS_API_URL = 'http://localhost:8000/api/v1';

// In-memory storage for job search tasks
const jobSearchTasks = new Map();

/**
 * Job Search Controller
 * Handles job search requests using Puppeteer (browser automation)
 */

/**
 * Analyze job against resume using ATS API
 */
const analyzeJobWithATS = async (resumeData, jobData, customWeights = null) => {
  try {
    const atsRequest = {
      resume: {
        full_name: resumeData.personalInfo?.fullName || '',
        email: resumeData.personalInfo?.email || '',
        phone: resumeData.personalInfo?.phone || '',
        location: resumeData.personalInfo?.location || '',
        summary: resumeData.summary || '',
        skills: resumeData.skills || [],
        work_experience: resumeData.experience?.map(exp => {
          const title = exp.title || '';
          const company = exp.company || '';
          const duration = `${exp.startDate || ''} - ${exp.endDate || 'Present'}`;
          const description = exp.description || '';
          return `${title} at ${company} (${duration}): ${description}`;
        }) || [],
        education: resumeData.education?.map(edu => {
          const degree = edu.degree || '';
          const institution = edu.institution || '';
          const year = edu.year || '';
          return `${degree}, ${institution} (${year})`;
        }) || [],
        projects: resumeData.projects?.map(proj => {
          const name = proj.name || '';
          const description = proj.description || '';
          const technologies = Array.isArray(proj.technologies) ? proj.technologies.join(', ') : '';
          return `${name}: ${description}${technologies ? ` [${technologies}]` : ''}`;
        }) || [],
        certifications: resumeData.certifications || [],
        years_of_experience: parseFloat(resumeData.totalExperience) || 0,
        work_authorization: resumeData.workAuthorization || '',
        highest_degree: resumeData.education?.[0]?.degree || ''
      },
      job_description: {
        job_title: jobData.title || '',
        company: jobData.company || '',
        location: jobData.location || 'Any',
        job_description: jobData.description || '',
        required_skills: extractSkillsFromDescription(jobData.description),
        preferred_skills: [],
        min_experience: parseExperience(jobData.experience),
        max_experience: parseExperience(jobData.experience) + 2,
        required_education: '',
        role_type: determineRoleType(jobData.title, jobData.experience)
      }
    };

    // Add custom weights if provided
    if (customWeights) {
      atsRequest.custom_weights = customWeights;
    }

    console.log('ATS Request:', JSON.stringify({
      job: jobData.title,
      company: jobData.company,
      description_length: jobData.description?.length || 0,
      custom_weights: customWeights ? 'Yes' : 'Default'
    }));

    const response = await axios.post(`${ATS_API_URL}/analyze`, atsRequest, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('ATS Response:', response.data?.overall_match_percentage || 'No score');
    return response.data;
  } catch (error) {
    console.error('ATS API Error for job:', jobData.title);
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.code === 'ECONNREFUSED') {
      console.error('Python ATS server is not running on', ATS_API_URL);
    }
    return null;
  }
};

/**
 * Extract skills from job description
 */
const extractSkillsFromDescription = (description) => {
  if (!description) return [];
  
  const commonSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'Angular',
    'Vue', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'MongoDB', 'PostgreSQL',
    'MySQL', 'REST', 'GraphQL', 'Git', 'CI/CD', 'Agile', 'Scrum'
  ];
  
  const descLower = description.toLowerCase();
  return commonSkills.filter(skill => descLower.includes(skill.toLowerCase()));
};

/**
 * Parse experience from string
 */
const parseExperience = (expStr) => {
  if (!expStr) return 0;
  const match = expStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
};

/**
 * Determine role type
 */
const determineRoleType = (title, experience) => {
  const titleLower = (title || '').toLowerCase();
  const expYears = parseExperience(experience);
  
  if (titleLower.includes('intern')) return 'intern';
  if (expYears === 0 || titleLower.includes('fresher') || titleLower.includes('junior')) return 'fresher';
  if (titleLower.includes('manager') || expYears > 8) return 'manager';
  if (titleLower.includes('lead') || titleLower.includes('senior') || expYears > 5) return 'lead';
  return 'software_engineer';
};

/**
 * Search for jobs based on user criteria
 * POST /api/jobs/search
 */
const searchJobs = async (req, res) => {
  try {
    const { role, designation, experienceLevel, location, jobType, resumeId, atsWeights } = req.body;
    
    // Extract userId from JWT token (set by authMiddleware)
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Check user's job search quota
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.jobSearchLimit === undefined || user.jobSearchLimit === null) {
      // Initialize quota for old users
      user.jobSearchLimit = 3;
      await user.save();
    }

    if (user.jobSearchLimit <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Job search limit exceeded. You have used all 3 searches.',
        searchLimit: 0
      });
    }

    // Validate required fields
    if (!role && !designation) {
      return res.status(400).json({
        success: false,
        message: 'Either role or designation is required'
      });
    }

    const keyword = role || designation;
    const searchLocation = location || 'India';
    const company = req.body.company || null;
    const platform = req.body.platform || null;

    // Generate task ID for polling
    const taskId = uuidv4();
    
    // Initialize task state
    jobSearchTasks.set(taskId, {
      status: 'searching',
      progress: 0,
      totalJobs: 0,
      processedJobs: 0,
      jobs: [],
      completed: false,
      error: null,
      startedAt: new Date(),
      userId: userId // Store userId for quota decrement
    });

    // Start background processing (don't await)
    processJobSearch(taskId, userId, keyword, searchLocation, experienceLevel, resumeId, atsWeights, company, platform).catch(err => {
      console.error(`Background job processing error for task ${taskId}:`, err);
    });

    // Return task ID immediately
    return res.status(202).json({
      success: true,
      message: 'Job search started',
      taskId: taskId,
      pollUrl: `/api/jobs/search/poll/${taskId}`,
      searchLimit: user.jobSearchLimit - 1 // Will be decremented after successful search
    });

  } catch (error) {
    console.error('❌ Error starting job search:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to start job search',
      error: error.message
    });
  }
};

/**
 * Background job processing with incremental ATS analysis
 */
const processJobSearch = async (taskId, userId, keyword, searchLocation, experienceLevel, resumeId, atsWeights, company = null, platform = null) => {
  try {
    const task = jobSearchTasks.get(taskId);
    
    // Step 1: Search jobs using JSearch API
    task.statusMessage = 'Searching jobs via JSearch API...';
    console.log(`🔍 Searching jobs: ${keyword} in ${searchLocation}${company ? ` at ${company}` : ''}${platform ? ` on ${platform}` : ''}`);
    
    const allJobs = await jSearchService.searchJobs(
      keyword, 
      searchLocation, 
      experienceLevel || 0,
      1, // Start from page 1
      1,  // Fetch 1 page (10 results per page, consumes 1 API request)
      company,
      platform
    );

    task.totalJobs = allJobs.length;
    task.status = 'analyzing';
    task.statusMessage = `Found ${allJobs.length} jobs`;
    console.log(`✅ Found ${allJobs.length} jobs from JSearch`);

    // Decrement user's job search quota after successful search
    try {
      await User.findByIdAndUpdate(userId, { 
        $inc: { jobSearchLimit: -1 } 
      });
      console.log(`✅ Decremented job search quota for user ${userId}`);
    } catch (error) {
      console.error('❌ Error decrementing job search quota:', error);
    }

    // Handle 0 jobs found - provide helpful message
    if (allJobs.length === 0) {
      const user = await User.findById(userId);
      const remainingSearches = user?.jobSearchLimit || 0;
      
      task.jobs = [];
      task.processedJobs = 0;
      task.progress = 100;
      task.status = 'completed';
      task.completed = true;
      task.noJobsMessage = {
        title: 'No Job Vacancies Found',
        message: company 
          ? `Unfortunately, there are no current openings for "${keyword}" at ${company} in ${searchLocation}.` 
          : `Unfortunately, there are no current openings for "${keyword}" in ${searchLocation}.`,
        suggestions: [
          '🔄 Try a general search instead of company-specific search for better results',
          '📍 Consider expanding your location or trying "remote" option',
          '🎯 Use different keywords or job titles',
          `⚠️ Your search limit has been reduced to ${remainingSearches}/3 - avoid unnecessary searches`
        ],
        wishMessage: 'Best wishes for your job search! Try again with different criteria.'
      };
      console.log(`⚠️ No jobs found for: ${keyword} in ${searchLocation}${company ? ` at ${company}` : ''}`);
      return;
    }

    // If no resumeId, return jobs without ATS
    if (!resumeId) {
      task.jobs = allJobs;
      task.processedJobs = allJobs.length;
      task.progress = 100;
      task.status = 'completed';
      task.completed = true;
      task.atsAnalyzed = false;
      return;
    }

    // Step 2: Fetch resume data
    const user = await User.findById(userId);
    const resume = user?.resumeDetails?.find(r => r._id.toString() === resumeId);

    if (!resume || !resume.resumeData) {
      console.log('⚠️ Resume not found, returning jobs without ATS');
      task.jobs = allJobs;
      task.processedJobs = allJobs.length;
      task.progress = 100;
      task.status = 'completed';
      task.completed = true;
      task.atsAnalyzed = false;
      return;
    }

    console.log(`🎯 Starting ATS analysis for ${allJobs.length} jobs...`);
    console.log(`📄 Using resume: ${resume.resumeName}`);

    // Step 3: Process jobs incrementally (analyze in batches of 3)
    const batchSize = 3;
    const jobsToAnalyze = allJobs.slice(0, 20); // Limit to 20 jobs
    
    for (let i = 0; i < jobsToAnalyze.length; i += batchSize) {
      const batch = jobsToAnalyze.slice(i, i + batchSize);
      
      // Analyze batch in parallel
      const batchPromises = batch.map(async (job) => {
        try {
          const atsAnalysis = await analyzeJobWithATS(resume.resumeData, job, atsWeights);
          return {
            ...job,
            atsScore: atsAnalysis?.overall_match_percentage ?? null,
            atsAnalysis: atsAnalysis ? {
              overall_match_percentage: atsAnalysis.overall_match_percentage,
              matched_skills: atsAnalysis.matched_skills || [],
              missing_skills: atsAnalysis.missing_skills || [],
              feedback: atsAnalysis.feedback || [],
              recommendations: atsAnalysis.recommendations || [],
              hard_filters: atsAnalysis.hard_filters || null
            } : null
          };
        } catch (error) {
          console.error(`⚠️ ATS analysis failed for job: ${job.title}`, error.message);
          return { ...job, atsScore: null, atsAnalysis: null };
        }
      });

      const analyzedBatch = await Promise.all(batchPromises);
      
      // Add analyzed jobs to results
      task.jobs.push(...analyzedBatch);
      task.processedJobs = task.jobs.length;
      task.progress = Math.round((task.processedJobs / jobsToAnalyze.length) * 100);
      
      console.log(`📊 Progress: ${task.processedJobs}/${jobsToAnalyze.length} jobs analyzed`);
    }

    // Step 4: Sort by ATS score
    task.jobs.sort((a, b) => {
      const scoreA = a.atsScore || 0;
      const scoreB = b.atsScore || 0;
      return scoreB - scoreA;
    });

    task.status = 'completed';
    task.completed = true;
    task.progress = 100;
    task.atsAnalyzed = true;
    
    console.log(`✅ ATS Analysis complete for task ${taskId}`);

    // Clean up task after 5 minutes
    setTimeout(() => {
      jobSearchTasks.delete(taskId);
      console.log(`🧹 Cleaned up task ${taskId}`);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error(`❌ Error processing job search ${taskId}:`, error);
    const task = jobSearchTasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error.message;
      task.completed = true;
    }
  }
};

/**
 * Get job details by scraping a specific URL
 * POST /api/jobs/details
 */
const getJobDetails = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Job URL is required'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Job details retrieved',
      data: {
        url,
        note: 'Detailed scraping not implemented yet. Click the URL to view on the original site.'
      }
    });

  } catch (error) {
    console.error('Error in getJobDetails controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get job details',
      error: error.message
    });
  }
};

/**
 * Health check endpoint
 * GET /api/jobs/health
 */
const healthCheck = async (req, res) => {
  try {
    const status = await jSearchService.checkStatus();
    
    return res.status(200).json({
      success: true,
      message: 'Job search service is running (JSearch API)',
      timestamp: new Date().toISOString(),
      api: {
        provider: 'JSearch (RapidAPI)',
        status: status.status,
        requestsLimit: status.requestsLimit,
        requestsRemaining: status.requestsRemaining,
        requestsResetIn: status.requestsReset ? `${status.requestsReset}s` : 'N/A'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Service unavailable',
      error: error.message
    });
  }
};

/**
 * Poll job search progress
 * GET /api/jobs/search/poll/:taskId
 */
const pollJobSearch = async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = jobSearchTasks.get(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or expired'
      });
    }

    // Map internal status to client-friendly status
    const clientStatus = (task.status === 'scraping' || task.status === 'analyzing') ? 'searching' : task.status;
    
    return res.status(200).json({
      success: true,
      taskId: taskId,
      status: clientStatus,
      statusMessage: task.statusMessage || '',
      progress: task.progress,
      totalJobs: task.totalJobs,
      processedJobs: task.processedJobs,
      completed: task.completed,
      jobs: task.jobs,
      searchUrl: task.searchUrl,
      atsAnalyzed: task.atsAnalyzed || false,
      noJobsMessage: task.noJobsMessage || null,
      error: task.error,
      lastUpdate: task.lastUpdate
    });

  } catch (error) {
    console.error('❌ Error polling job search:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to poll job search',
      error: error.message
    });
  }
};

/**
 * Get user's remaining job search quota
 * GET /api/jobs/quota
 */
const getUserQuota = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize quota for old users
    if (user.jobSearchLimit === undefined || user.jobSearchLimit === null) {
      user.jobSearchLimit = 3;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      searchLimit: user.jobSearchLimit,
      maxLimit: 3,
      extensionRequest: {
        requested: user.jobSearchLimitExtensionRequest?.requested || false,
        status: user.jobSearchLimitExtensionRequest?.status || null,
        requestedAt: user.jobSearchLimitExtensionRequest?.requestedAt || null
      }
    });

  } catch (error) {
    console.error('❌ Error getting user quota:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get user quota',
      error: error.message
    });
  }
};

module.exports = {
  searchJobs,
  pollJobSearch,
  getJobDetails,
  healthCheck,
  getUserQuota
};
