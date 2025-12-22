const UserService = require('../../services/userService');
const DataParser = require('../../utils/dataParser');
const { ERROR_CODES } = require('../../constants/errorCodes');
const crypto = require('crypto');

class VerificationController {
  static async confirmEmail(req, res) {
    try {
      const { email, token, password, type } = req.body;

      // Validate inputs
      if (!email || !token || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Email, token, and password are required'
        });
      }

      // Find user by email
      const user = await UserService.findUserByEmail(email);

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Verify token
      if (user.verificationToken !== token) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid verification token'
        });
      }

      // Check token expiration
      if (user.verificationTokenExpires && new Date() > user.verificationTokenExpires) {
        return res.status(400).json({
          status: 'error',
          message: 'Verification token has expired'
        });
      }

      // For both signup verification and password reset: Update password in DB
      // No validation needed - user confirms via email link
      const result = await UserService.updateUser(user._id, {
        password: password,
        isActive: true,
        status: 'active',
        verificationToken: null,
        verificationTokenExpires: null
      });

      if (!result.success) {
        return res.status(500).json({
          status: 'error',
          message: type === 'reset' ? 'Failed to reset password' : 'Failed to verify email'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: type === 'reset' 
          ? 'Password reset successfully. You can now login with your new password.'
          : 'Email verified successfully. You can now login.'
      });

    } catch (error) {
      return res.status(500).json({
        status: 'error',
        code: ERROR_CODES.ERC5,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Set password after email verification
   * POST /skill-mint/set-password
   * Body: { email, password, confirmPassword }
   */
  static async setPassword(req, res) {
    try {
      const { email, password, confirmPassword } = req.body;

      // Validate inputs
      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Email is required'
        });
      }

      if (!password || !confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Password and confirmation password are required'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Passwords do not match'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must be at least 6 characters long'
        });
      }

      // Find user by email
      const user = await UserService.findUserByEmail(email);

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Update user: set password, activate status and isActive
      const result = await UserService.updateUser(user._id, {
        password: password,
        isActive: true,
        status: 'active'
      });

      if (!result.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to set password'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Password set successfully. You can now login.'
      });

    } catch (error) {
      return res.status(500).json({
        status: 'error',
        code: ERROR_CODES.ERC5,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Verify email and set password (legacy endpoint)
   * POST /skill-mint/verify-email?email=<email>&token=<token>
   * Body: { password, confirmPassword }
   */
  static async verifyEmail(req, res) {
    try {
      const { email, token } = req.query;
      const { password, confirmPassword } = req.body;

      // Validate inputs
      if (!email || !token) {
        return res.status(400).json({
          status: 'error',
          message: 'Email and token are required'
        });
      }

      if (!password || !confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Password and confirmation password are required'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Passwords do not match'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must be at least 6 characters long'
        });
      }

      // Find user by email
      const user = await UserService.findUserByEmail(email);

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Check if already verified
      if (user.status === 'active') {
        return res.status(400).json({
          status: 'error',
          message: 'Email already verified'
        });
      }

      // Verify token
      if (user.verificationToken !== token) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid verification token'
        });
      }

      // Check token expiration
      if (user.verificationTokenExpires && new Date() > user.verificationTokenExpires) {
        return res.status(400).json({
          status: 'error',
          message: 'Verification token has expired'
        });
      }

      // Update user: set password, activate status, clear verification token
      const result = await UserService.updateUser(user._id, {
        password: password,
        status: 'active',
        verificationToken: null,
        verificationTokenExpires: null
      });

      if (!result.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to verify email'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Email verified successfully. You can now login.'
      });

    } catch (error) {
      return res.status(500).json({
        status: 'error',
        code: ERROR_CODES.ERC5,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Generate verification token
   */
  static generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Request password reset
   * POST /skill-mint/forgot-password
   * Body: { email }
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      // Validate input
      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Email is required'
        });
      }

      // Find user by email
      const user = await UserService.findUserByEmail(email);

      if (!user) {
        // Don't reveal if user exists or not for security
        return res.status(200).json({
          status: 'success',
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // Generate reset token
      const resetToken = VerificationController.generateVerificationToken();
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with reset token
      const result = await UserService.updateUser(user._id, {
        verificationToken: resetToken,
        verificationTokenExpires: tokenExpires
      });

      if (!result.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to generate reset token'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent.',
        data: {
          email: user.email,
          resetToken: resetToken
        }
      });

    } catch (error) {
      return res.status(500).json({
        status: 'error',
        code: ERROR_CODES.ERC5,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Set password for Google sign-in users
   * POST /skill-mint/set-google-password
   * Body: { email, password, confirmPassword }
   */
  static async setGooglePassword(req, res) {
    try {
      const { email, password, confirmPassword } = req.body;

      // Validate inputs
      if (!email || !password || !confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Email, password, and confirmation password are required'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Passwords do not match'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must be at least 6 characters long'
        });
      }

      // Find user by email
      const user = await UserService.findUserByEmail(email);

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Verify this is a Google user
      if (user.loginMethod !== 'google') {
        return res.status(400).json({
          status: 'error',
          message: 'This endpoint is only for Google sign-in users'
        });
      }

      // Update user: set password and activate status
      const result = await UserService.updateUser(user._id, {
        password: password,
        isActive: true,
        status: 'active'
      });

      if (!result.success) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to set password'
        });
      }

      // Generate JWT token and login the user
      const JWTUtils = require('../../utils/jwtUtils');
      const token = JWTUtils.generateToken({
        userId: user._id,
        email: user.email,
        loginMethod: user.loginMethod
      });

      // Set cookie
      const isProduction = process.env.NODE_ENV === 'production';
      const secureFlag = isProduction || req.secure || req.headers['x-forwarded-proto'] === 'https';
      const cookieOpts = {
        httpOnly: true,
        secure: isProduction ? true : !!secureFlag,
        sameSite: 'None',
        domain: '.skillhubtools.store',
        path: '/',
        maxAge: 3 * 60 * 60 * 1000
      };

      res.cookie('authToken', token, cookieOpts);

      return res.status(200).json({
        status: 'success',
        message: 'Password set successfully',
        token: token
      });

    } catch (error) {
      return res.status(500).json({
        status: 'error',
        code: ERROR_CODES.ERC5,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = VerificationController;
