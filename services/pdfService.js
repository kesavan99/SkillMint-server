const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

class PDFService {
  async generateResumeHTML(resumeData, templateName = 'resume-template') {
    try {
      // Validate template name to prevent path traversal
      const validTemplates = [
        'resume-template',
        'resume-template-minimalist',
        'resume-template-two-column',
        'resume-template-executive',
        'resume-template-skills-first',
        'resume-template-creative'
      ];

      const selectedTemplate = validTemplates.includes(templateName) 
        ? templateName 
        : 'resume-template';

      // Read the selected Handlebars template
      const templatePath = path.join(__dirname, `../templates/${selectedTemplate}.hbs`);
      
      const templateSource = await fs.readFile(templatePath, 'utf-8');
      
      // Compile the template
      const template = handlebars.compile(templateSource);
      
      // Generate HTML with data
      const html = template(resumeData);
      
      return html;
    } catch (error) {
      throw new Error('Failed to generate HTML preview');
    }
  }
}

module.exports = new PDFService();
