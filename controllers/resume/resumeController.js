const pdfService = require('../../services/pdfService');
const pdfParserService = require('../../services/pdfParserService');
const geminiService = require('../../services/geminiService');
const User = require('../../models/schemas/userSchema');
// const { scanBuffer } = require("../../utils/clamScanner");

exports.uploadAndParsePDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please upload a PDF file' 
      });
    }
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ 
        error: 'Invalid file type',
        message: 'Only PDF files are allowed' 
      });
    }

    // const scanResult = await scanBuffer(req.file.buffer);
    // if (scanResult.isInfected) {

    //   return res.status(400).json({
    //     error: "Malicious PDF detected",
    //     message: `Infected with: ${scanResult.viruses.join(", ")}`
    //   });
    // }

    const extractedText = await pdfParserService.extractTextFromPDF(req.file.buffer);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Empty PDF',
        message: 'Could not extract text from the PDF. Please try a different file.' 
      });
    }

    const parsedResumeData = await geminiService.parseResumeWithAI(extractedText);

    // Send the parsed data back to the client
    return res.status(200).json({
      success: true,
      data: parsedResumeData
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to process PDF',
      message: error.message 
    });
  }
};

// New endpoint for dynamic resume builder - returns structured object with id fields
exports.uploadAndParseDynamicPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please upload a PDF file' 
      });
    }
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ 
        error: 'Invalid file type',
        message: 'Only PDF files are allowed' 
      });
    }

    const extractedText = await pdfParserService.extractTextFromPDF(req.file.buffer);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Empty PDF',
        message: 'Could not extract text from the PDF. Please try a different file.' 
      });
    }

    const parsedResumeData = await geminiService.parseResumeWithAI(extractedText);

    // Transform the data to match DynamicResumeEditor structure with id fields
    const dynamicResumeData = {
      personalInfo: {
        name: parsedResumeData.personalInfo?.name || '',
        email: parsedResumeData.personalInfo?.email || '',
        phone: parsedResumeData.personalInfo?.phone || '',
        linkedin: parsedResumeData.personalInfo?.linkedin || ''
      },
      summary: parsedResumeData.summary || '',
      skills: parsedResumeData.skills || [],
      education: (parsedResumeData.education || []).map((edu, idx) => ({
        id: `edu-${Date.now()}-${idx}`,
        institution: edu.institution || '',
        degree: edu.degree || '',
        year: edu.year || ''
      })),
      experience: (parsedResumeData.experience || []).map((exp, idx) => ({
        id: `exp-${Date.now()}-${idx}`,
        title: exp.title || '',
        company: exp.company || '',
        duration: exp.duration || '',
        description: exp.description || ''
      })),
      projects: (parsedResumeData.projects || []).map((proj, idx) => ({
        id: `proj-${Date.now()}-${idx}`,
        name: proj.name || '',
        description: proj.description || '',
        technologies: proj.technologies || ''
      })),
      certifications: parsedResumeData.certifications || []
    };

    // Send the parsed data back to the client
    return res.status(200).json({
      success: true,
      data: dynamicResumeData
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to process PDF',
      message: error.message 
    });
  }
};

exports.generatePreview = async (req, res) => {
  try {
    const { template = 'resume-template', ...resumeData } = req.body;
    
    // Validate required fields
    if (!resumeData.personalInfo || !resumeData.personalInfo.name) {
      return res.status(400).json({ 
        error: 'Invalid resume data',
        message: 'Personal info with name is required' 
      });
    }

    // Generate HTML preview with selected template
    const htmlContent = await pdfService.generateResumeHTML(resumeData, template);

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to generate preview',
      message: error.message 
    });
  }
};

// Save resume JSON to user's resumeDetails
exports.saveResume = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware
    const { resumeId, resumeName, template = 'resume-template', isDynamic = false, ...resumeData } = req.body;

    // Validate required fields
    if (!resumeData.personalInfo || !resumeData.personalInfo.name) {
      return res.status(400).json({ 
        error: 'Invalid resume data',
        message: 'Personal info with name is required' 
      });
    }

    if (!resumeName || resumeName.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid resume name',
        message: 'Resume name is required' 
      });
    }

    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if updating existing resume or creating new one
    if (resumeId) {
      // Update existing resume
      const resumeIndex = user.resumeDetails.findIndex(r => r.resumeId === resumeId);
      
      if (resumeIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Resume not found'
        });
      }

      user.resumeDetails[resumeIndex] = {
        resumeId,
        resumeName: resumeName.trim(),
        resumeData: { ...resumeData },
        generatedDate: user.resumeDetails[resumeIndex].generatedDate, // Keep original date
        templateName: template,
        isDynamic: isDynamic // Store isDynamic flag
      };

      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Resume updated successfully',
        data: {
          resumeId,
          resumeName: resumeName.trim(),
          generatedDate: user.resumeDetails[resumeIndex].generatedDate,
          templateName: template,
          isDynamic: isDynamic
        }
      });
    } else {
      // Create new resume with random ID
      const crypto = require('crypto');
      const newResumeId = `resume_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;

      // Add new resume to resumeDetails array
      user.resumeDetails.push({
        resumeId: newResumeId,
        resumeName: resumeName.trim(),
        resumeData: { ...resumeData },
        generatedDate: new Date(),
        templateName: template,
        isDynamic: isDynamic // Store isDynamic flag
      });

      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Resume saved successfully',
        data: {
          resumeId: newResumeId,
          resumeName: resumeName.trim(),
          totalResumes: user.resumeDetails.length,
          generatedDate: user.resumeDetails[user.resumeDetails.length - 1].generatedDate,
          templateName: user.resumeDetails[user.resumeDetails.length - 1].templateName,
          isDynamic: isDynamic
        }
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to save resume',
      message: error.message 
    });
  }
};

// Get all saved resumes for a user
exports.getSavedResumes = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware

    const user = await User.findById(userId).select('resumeDetails');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.resumeDetails || user.resumeDetails.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'N/A',
        data: []
      });
    }

    // Return resumes metadata
    const resumeList = user.resumeDetails.map((resume, index) => ({
      id: resume._id,
      resumeId: resume.resumeId,
      resumeName: resume.resumeName,
      index: index,
      generatedDate: resume.generatedDate,
      templateName: resume.templateName,
      isDynamic: resume.isDynamic || false
    }));

    res.status(200).json({
      success: true,
      data: resumeList
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch saved resumes',
      message: error.message 
    });
  }
};

// Get specific resume data by resumeId for editing
exports.getResumeById = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware
    const { id } = req.params; // This is resumeId

    const user = await User.findById(userId).select('resumeDetails');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const resume = user.resumeDetails.find(r => r.resumeId === id);
    
    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        resumeId: resume.resumeId,
        resumeName: resume.resumeName,
        resumeData: resume.resumeData,
        templateName: resume.templateName,
        generatedDate: resume.generatedDate
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch resume',
      message: error.message 
    });
  }
};

// Delete resume by resumeId
exports.deleteResume = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware
    const { id } = req.params; // This is resumeId

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const resumeIndex = user.resumeDetails.findIndex(r => r.resumeId === id);
    
    if (resumeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Remove the resume from array
    const deletedResume = user.resumeDetails[resumeIndex];
    user.resumeDetails.splice(resumeIndex, 1);

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Resume deleted successfully',
      data: {
        deletedResumeId: id,
        deletedResumeName: deletedResume.resumeName,
        remainingResumes: user.resumeDetails.length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to delete resume',
      message: error.message 
    });
  }
};
