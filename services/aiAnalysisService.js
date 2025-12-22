const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAIInstance = null;

const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.');
  }

  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  return genAIInstance;
};

const getModelPriorityList = () => {
  const configuredModels = (process.env.GEMINI_MODEL_ID || '')
    .split(',')
    .map(id => id && id.trim())
    .filter(Boolean);

  const fallbackModels = (process.env.GEMINI_MODEL_FALLBACKS || '')
    .split(',')
    .map(id => id && id.trim())
    .filter(Boolean);

  const defaultModels = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemma-3-27b',
    'gemma-3-12b',
    'gemma-3-4b',
    'gemma-3-2b'
  ];

  const priorityList = [...configuredModels, ...fallbackModels, ...defaultModels];
  return [...new Set(priorityList)];
};

const isRateLimitError = (error) => {
  if (!error) return false;
  if (error.code === 429 || Number(error.status) === 429) return true;
  if (error.status === 'RESOURCE_EXHAUSTED') return true;
  const message = error.message || '';
  return /quota|rate limit|RESOURCE_EXHAUSTED/i.test(message);
};

/**
 * Analyze resume with Gemini AI
 */
async function analyzeResumeWithAI(resumeData, jobRole, experienceLevel) {
  try {
    const aiClient = getGeminiClient();

    // Convert resume data to readable text
    const resumeText = formatResumeData(resumeData);

    const prompt = `You are an expert resume reviewer and career advisor. Analyze the following resume for the specified job role and experience level.

RESUME DATA:
${resumeText}

TARGET JOB ROLE: ${jobRole}
EXPERIENCE LEVEL: ${experienceLevel}

Provide a comprehensive analysis in the following JSON format:
{
  "score": number between 0-100 representing overall resume quality,
  "matchPercentage": number between 0-100 representing how well the resume matches the job role,
  "missingSkills": [
    "Analyze the job description and identify critical skills, technologies, tools, and frameworks mentioned that are NOT present in the resume's skills section. Return only the skill names as strings (e.g., 'Spring Boot', 'Docker', 'AWS'). If no skills are missing, return an empty array"
  ],
  "strengths": [
    "List 3-5 key strengths of the resume",
     "suggest why these are strengths in relation to the job role and share topic need to revision for interbview"
  ],
  "weaknesses": [
    "List 3-5 areas that need improvement",
    "explain why these are weaknesses in relation to the job role",
    "suggest topic need to revision for interview and website reference"
  ],
  "suggestions": [
    {
      "category": "Professional Summary",
      "recommendation": "How to tailor the Professional Summary to better match the job role"
    },
    {
      "category": "Skills Development Path",
      "recommendation": "Based on current skills and ${experienceLevel} experience level, suggest specific technologies, frameworks, and tools to learn next. For example: If candidate knows Java, suggest Spring Boot, JPA, Hibernate, Servlets, JDBC, Maven/Gradle for mid-level; add Microservices, Kubernetes, Docker for senior level",
      "learningPath": "List 5-7 specific technologies/topics with brief explanation of why each is important for the target role"
    },
    {
      "category": "Experience Enhancement",
      "recommendation": "How to improve or rewrite experience descriptions to better showcase relevant achievements"
    },
    {
      "category": "Project Portfolio",
      "recommendation": "Suggest 2-3 project ideas or improvements to existing projects that would strengthen the resume for this role"
    },
    {
      "category": "Certifications",
      "recommendation": "Recommend relevant certifications or courses that would add value for the ${jobRole} role at ${experienceLevel} level"
    }
  ],
  "interviewPreparation": {
    "technicalTopics": [
      "List 5-8 key technical topics the candidate should review for interviews based on their current skills and target role",
      "Include both topics they know (for depth) and topics they should learn (for gaps)",
      "Be specific: instead of 'databases', mention 'SQL optimization, indexing strategies, transaction management'"
    ],
    "studyResources": [
      "Suggest 3-5 specific resources (documentation, courses, or practice platforms) for interview preparation",
      "Tailor to experience level: junior might need fundamentals, senior needs architecture and system design"
    ]
  }

Analysis criteria:
1. Relevance to the ${jobRole} role
2. Appropriate for ${experienceLevel} experience level
3. Technical skills alignment
4. Professional experience quality and relevance
5. Education background
6. Project portfolio strength
7. Overall presentation and clarity
8. Missing critical elements for the role

Return ONLY valid JSON without any markdown formatting or explanation.`;

    const modelPriorityList = getModelPriorityList();
    let lastError;

    for (const modelId of modelPriorityList) {
      try {
        const model = aiClient.getGenerativeModel({ model: modelId });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        if (!text) {
          throw new Error(`Model ${modelId} returned an empty response.`);
        }

        // Remove markdown code blocks and sanitize
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Remove any control characters that might break JSON parsing
        text = text.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '');
        
        const analysis = JSON.parse(text);

        if (modelId !== modelPriorityList[0]) {
        }

        return analysis;
      } catch (modelError) {
        lastError = modelError;

        if (isRateLimitError(modelError)) {
          continue;
        }

        throw modelError;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error('Gemini model list is empty. Configure GEMINI_MODEL_ID or use defaults.');
  } catch (error) {
    throw new Error('Failed to analyze resume with AI: ' + error.message);
  }
}

/**
 * Format resume data into readable text
 */
function formatResumeData(data) {
  let text = '';

  // Personal Info
  if (data.personalInfo) {
    text += '=== PERSONAL INFORMATION ===\n';
    text += `Name: ${data.personalInfo.name}\n`;
    text += `Email: ${data.personalInfo.email}\n`;
    text += `Phone: ${data.personalInfo.phone}\n`;
    text += `Location: ${data.personalInfo.location}\n`;
    if (data.personalInfo.linkedin) text += `LinkedIn: ${data.personalInfo.linkedin}\n`;
    if (data.personalInfo.portfolio) text += `Portfolio: ${data.personalInfo.portfolio}\n`;
    text += '\n';
  }

  // Summary
  if (data.summary) {
    text += '=== PROFESSIONAL SUMMARY ===\n';
    text += `${data.summary}\n\n`;
  }

  // Education
  if (data.education && data.education.length > 0) {
    text += '=== EDUCATION ===\n';
    data.education.forEach((edu, index) => {
      text += `${index + 1}. ${edu.degree}\n`;
      text += `   ${edu.institution} (${edu.year})\n`;
      if (edu.gpa) text += `   GPA: ${edu.gpa}\n`;
      text += '\n';
    });
  }

  // Experience
  if (data.experience && data.experience.length > 0) {
    text += '=== WORK EXPERIENCE ===\n';
    data.experience.forEach((exp, index) => {
      text += `${index + 1}. ${exp.title} at ${exp.company}\n`;
      text += `   Duration: ${exp.duration}\n`;
      text += `   ${exp.description}\n\n`;
    });
  }

  // Skills
  if (data.skills && data.skills.length > 0) {
    text += '=== SKILLS ===\n';
    text += data.skills.join(', ') + '\n\n';
  }

  // Projects
  if (data.projects && data.projects.length > 0) {
    text += '=== PROJECTS ===\n';
    data.projects.forEach((proj, index) => {
      text += `${index + 1}. ${proj.name}\n`;
      text += `   ${proj.description}\n`;
      text += `   Technologies: ${proj.technologies}\n\n`;
    });
  }

  // Certifications
  if (data.certifications && data.certifications.length > 0) {
    text += '=== CERTIFICATIONS ===\n';
    data.certifications.forEach((cert, index) => {
      text += `${index + 1}. ${cert}\n`;
    });
    text += '\n';
  }

  return text;
}

module.exports = {
  analyzeResumeWithAI
};
