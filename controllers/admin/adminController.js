const User = require('../../models/schemas/userSchema');
const Contact = require('../../models/schemas/contactSchema');

class AdminController {
  static async getAllUsers(req, res) {
    try {
      // Verify admin role from JWT
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin only.'
        });
      }

      // Fetch all users with selected fields
      const users = await User.find({})
        .select('name email phone loginMethod isActive status lastLogin loginCount createdAt profilePicture details')
        .sort({ lastLogin: -1 }) // Sort by most recent login
        .lean();

      // Format user data
      const formattedUsers = users.map(user => ({
        id: user._id,
        name: user.name || 'N/A',
        email: user.email,
        phone: user.phone || 'N/A',
        loginMethod: user.loginMethod,
        status: user.status,
        isActive: user.isActive,
        lastLogin: user.lastLogin || null,
        loginCount: user.loginCount || 1,
        createdAt: user.createdAt,
        profilePicture: user.profilePicture || null,
        designation: user.details?.designation || 'N/A',
        areaOfInterest: user.details?.areaOfInterest || 'N/A'
      }));

      res.status(200).json({
        success: true,
        data: {
          totalUsers: formattedUsers.length,
          users: formattedUsers
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error.message
      });
    }
  }

  static async getAllContactMessages(req, res) {
    try {
      // Verify admin role from JWT
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin only.'
        });
      }

      // Fetch all contact messages
      const messages = await Contact.find({})
        .sort({ createdAt: -1 }) // Sort by most recent first
        .lean();

      res.status(200).json({
        success: true,
        data: {
          totalMessages: messages.length,
          messages: messages
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch contact messages',
        error: error.message
      });
    }
  }

  static async updateContactMessageStatus(req, res) {
    try {
      // Verify admin role from JWT
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin only.'
        });
      }

      const { messageId } = req.params;
      const { status } = req.body;

      if (!['new', 'read', 'resolved'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be new, read, or resolved.'
        });
      }

      const message = await Contact.findByIdAndUpdate(
        messageId,
        { status },
        { new: true }
      );

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Contact message not found'
        });
      }

      res.status(200).json({
        success: true,
        data: message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update message status',
        error: error.message
      });
    }
  }

  static async getJobSearchExtensionRequests(req, res) {
    try {
      // Verify admin role from JWT
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin only.'
        });
      }

      // Fetch users with pending extension requests
      const requests = await User.find({
        'jobSearchLimitExtensionRequest.requested': true
      })
        .select('email name jobSearchLimitExtensionRequest jobSearchLimit')
        .sort({ 'jobSearchLimitExtensionRequest.requestedAt': -1 })
        .lean();

      const formattedRequests = requests.map(user => ({
        id: user._id,
        email: user.email,
        name: user.name || 'N/A',
        currentLimit: user.jobSearchLimit,
        requested: user.jobSearchLimitExtensionRequest.requested,
        requestedAt: user.jobSearchLimitExtensionRequest.requestedAt,
        message: user.jobSearchLimitExtensionRequest.message,
        status: user.jobSearchLimitExtensionRequest.status
      }));

      res.status(200).json({
        success: true,
        data: {
          totalRequests: formattedRequests.length,
          requests: formattedRequests
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch extension requests',
        error: error.message
      });
    }
  }

  static async updateJobSearchLimit(req, res) {
    try {
      // Verify admin role from JWT
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin only.'
        });
      }

      const { userId } = req.params;
      const { newLimit, requestStatus } = req.body;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update limit if provided
      if (newLimit !== undefined) {
        user.jobSearchLimit = newLimit;
      }

      // Update request status if provided
      if (requestStatus) {
        user.jobSearchLimitExtensionRequest.status = requestStatus;
      }

      await user.save();

      res.status(200).json({
        success: true,
        message: 'Job search limit updated successfully',
        data: {
          email: user.email,
          jobSearchLimit: user.jobSearchLimit,
          requestStatus: user.jobSearchLimitExtensionRequest.status
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update job search limit',
        error: error.message
      });
    }
  }
}

module.exports = AdminController;
