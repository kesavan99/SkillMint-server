const UserService = require('../../services/userService');
const DataParser = require('../../utils/dataParser');
const JWTUtils = require('../../utils/jwtUtils');
const { ERROR_CODES } = require('../../constants/errorCodes');
const crypto = require('crypto');

class AuthController {
  static async login(req, res) {
    try {
      const rawData = req.body;
      
      const isSignup = rawData.newOne === true;
      
      const cleanData = DataParser.parseUserData(rawData);
      
      if (!cleanData.email || !cleanData.password) {
        return res.status(400).json({
          status: 'error',
          code: ERROR_CODES.ERC1
        });
      }
      
      const existingUser = await UserService.findUserByEmail(cleanData.email);
      
      if (isSignup) {
        if (existingUser) {
          return res.status(409).json({
            status: 'error',
            code: ERROR_CODES.ERC2,
            message: 'Email already registered'
          });
        }
        
        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        // Create user with status = 'inactive' and isActive = false
        const userData = {
          email: cleanData.email,
          password: cleanData.password,
          name: cleanData.name,
          phone: cleanData.phone,
          loginMethod: 'email',
          isActive: false,
          status: 'inactive',
          verificationToken,
          verificationTokenExpires
        };
        
        const result = await UserService.createUser(userData);
        
        return res.status(201).json({
          status: 'success',
          message: 'Account created. Please verify your email.',
          data: {
            email: result.data.email,
            name: result.data.name,
            verificationToken: verificationToken
          }
        });
      } else {
        if (!existingUser) {
          return res.status(404).json({
            status: 'error',
            code: ERROR_CODES.ERC3,
            message: 'User not found'
          });
        }
        
        // Check if account is verified
        if (existingUser.status === 'inactive' || existingUser.status === 'pending') {
          return res.status(403).json({
            status: 'error',
            message: 'Please verify your email before logging in'
          });
        }
        
        if (existingUser.password !== cleanData.password) {
          return res.status(401).json({
            status: 'error',
            code: ERROR_CODES.ERC4,
            message: 'Invalid password'
          });
        }
        
        // Update lastLogin and increment loginCount
        existingUser.lastLogin = new Date();
        existingUser.loginCount = (existingUser.loginCount || 0) + 1;
        await existingUser.save();
        
        // Generate JWT token
        const token = JWTUtils.generateToken({
          userId: existingUser._id,
          email: existingUser.email,
          loginMethod: existingUser.loginMethod
        });
        
        // Set cookie (HttpOnly, SameSite=None for cross-site). Determine Secure flag per-request
        const isProduction = process.env.NODE_ENV === 'production';
        const secureFlag = isProduction || req.secure || req.headers['x-forwarded-proto'] === 'https';
        const cookieOpts = {
          httpOnly: true,
          secure: isProduction ? true : !!secureFlag,
          sameSite: isProduction ? 'None' : 'Lax',
          path: '/',
          maxAge: 3 * 60 * 60 * 1000
        };
        
        // Only set domain in production
        if (isProduction) {
          cookieOpts.domain = '.skillhubtools.store';
        }

        res.cookie('token', token, cookieOpts);
        
        return res.status(200).json({
          status: 'success',
          message: 'Login successful',
          data: {
            email: existingUser.email,
            name: existingUser.name,
            loginMethod: existingUser.loginMethod
          },
          token: token
        });
      }
      
    } catch (error) {
      
      // If error has custom error code, use it
      if (error.code && error.code.startsWith('ERC')) {
        return res.status(500).json({
          status: 'error',
          code: error.code
        });
      }
      
      // Default internal server error
      return res.status(500).json({
        status: 'error',
        code: ERROR_CODES.ERC5
      });
    }
  }

  static async checkSession(req, res) {
    try {
      const token = req.cookies && (req.cookies.token || req.cookies.authToken);

      if (!token) {
        return res.status(401).json({ loggedIn: false, message: 'Not authenticated' });
      }

      // Verify token
      let payload;
      try {
        payload = require('../../utils/jwtUtils').verifyToken(token);
      } catch (err) {
        return res.status(401).json({ loggedIn: false, message: 'Not authenticated' });
      }

      // Attempt to get fresh user info (name may not be present in token)
      const User = require('../../models/schemas/userSchema');
      let user = null;
      try {
        if (payload.email) {
          user = await User.findOne({ email: payload.email.toLowerCase() }).select('email name _id');
        } else if (payload.userId) {
          user = await User.findById(payload.userId).select('email name _id');
        }
      } catch (err) {
        // ignore DB errors and fall back to token payload
        user = null;
      }

      const userObj = user
        ? { id: user._id, email: user.email, name: user.name }
        : { id: payload.userId || null, email: payload.email || null };

      // decode token to extract expiry if present
      const decoded = require('../../utils/jwtUtils').decodeToken(token) || {};
      let expiresAt;
      if (decoded.exp) {
        expiresAt = new Date(decoded.exp * 1000).toISOString();
      }

      const response = { loggedIn: true, user: userObj };
      if (expiresAt) response.expiresAt = expiresAt;

      return res.status(200).json(response);
    } catch (error) {
      return res.status(401).json({ loggedIn: false, message: 'Not authenticated' });
    }
  }

  static async googleLogin(req, res) {
    try {
      const { email, name, googleId, profilePicture } = req.body;
      
      if (!email || !googleId) {
        return res.status(400).json({
          status: 'error',
          code: ERROR_CODES.ERC1,
          message: 'Email and Google ID are required'
        });
      }
      
      const result = await UserService.createOrUpdateGoogleUser({
        email,
        name,
        googleId,
        profilePicture
      });
      
      // If user needs to set password, don't set cookie yet
      if (result.needsPassword) {
        return res.status(200).json({
          status: 'success',
          message: 'Please set a password to complete your account',
          needsPassword: true,
          isNewUser: result.isNewUser,
          data: {
            email: result.data.email,
            name: result.data.name,
            googleId: googleId
          }
        });
      }
      
      // Generate JWT token
      const token = JWTUtils.generateToken({
        userId: result.data.id,
        email: result.data.email,
        loginMethod: 'google'
      });
      
      // Set cookie (HttpOnly, SameSite=None for cross-site). Determine Secure flag per-request
      const isProduction = process.env.NODE_ENV === 'production';
      const secureFlag = isProduction || req.secure || req.headers['x-forwarded-proto'] === 'https';
      const cookieOpts = {
        httpOnly: true,
        secure: isProduction ? true : !!secureFlag,
        sameSite: isProduction ? 'None' : 'Lax',
        path: '/',
        maxAge: 3 * 60 * 60 * 1000
      };
      
      // Only set domain in production
      if (isProduction) {
        cookieOpts.domain = '.skillhubtools.store';
      }

      res.cookie('token', token, cookieOpts);
      
      return res.status(200).json({
        status: 'success',
        message: 'Google login successful',
        needsPassword: false,
        data: result.data,
        token: token
      });
      
    } catch (error) {
      console.error('Google login error:', error);
      
      if (error.code && error.code.startsWith('ERC')) {
        return res.status(500).json({
          status: 'error',
          code: error.code,
          message: process.env.NODE_ENV === 'development' ? error.message : undefined,
          details: process.env.NODE_ENV === 'development' ? error.originalError?.message : undefined
        });
      }
      
      return res.status(500).json({
        status: 'error',
        code: ERROR_CODES.ERC5,
        message: 'Google login failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async logout(req, res) {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const clearOpts = {
      httpOnly: true,
      secure: isProduction ? true : false,
      sameSite: isProduction ? 'None' : 'Lax',
      path: '/',
    };
    
    // Only set domain in production
    if (isProduction) {
      clearOpts.domain = '.skillhubtools.store';
    }
    
    res.clearCookie('token', clearOpts);

    return res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Logout failed'
    });
  }
}

static async adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    // Get admin credentials from environment variables
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return res.status(500).json({
        status: 'error',
        message: 'Admin login not configured'
      });
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid admin credentials'
      });
    }

    // Generate admin JWT token
    const adminToken = JWTUtils.generateToken({ 
      userId: 'admin', 
      email: ADMIN_EMAIL,
      role: 'admin'
    });

    // Set cookie with same logic as regular login
    const isProduction = process.env.NODE_ENV === 'production';
    const secureFlag = isProduction || req.secure || req.headers['x-forwarded-proto'] === 'https';
    const cookieOpts = {
      httpOnly: true,
      secure: isProduction ? true : !!secureFlag,
      sameSite: isProduction ? 'None' : 'Lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    };
    
    // Only set domain in production
    if (isProduction) {
      cookieOpts.domain = '.skillhubtools.store';
    }

    res.cookie('token', adminToken, cookieOpts);

    return res.status(200).json({
      status: 'success',
      message: 'Admin login successful',
      data: {
        email: ADMIN_EMAIL,
        role: 'admin'
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Admin login failed'
    });
  }
}


}

module.exports = AuthController;
