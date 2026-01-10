const Contact = require('../../models/schemas/contactSchema');

const contactController = {
  async sendContactMessage(req, res) {
    try {
      const { subject, message } = req.body;

      // Validate input
      if (!subject || !message) {
        return res.status(400).json({
          success: false,
          message: 'Subject and message are required'
        });
      }

      // Get user details from authenticated user
      const { name, email } = req.user;

      // Save to database
      const contactMessage = new Contact({
        name,
        email,
        subject,
        message,
        status: 'new'
      });

      await contactMessage.save();

      res.status(200).json({
        success: true,
        message: 'Message sent successfully! We will get back to you soon.'
      });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message. Please try again later.'
      });
    }
  }
};

module.exports = contactController;
