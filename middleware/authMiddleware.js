const JWTUtils = require('../utils/jwtUtils');
const { ERROR_CODES, ERROR_MESSAGES } = require('../constants/errorCodes');

/**
 * Middleware to verify JWT token from cookie
 */
const authMiddleware = (req, res, next) => {
  try {
    // Get token from cookie (support both 'token' and 'authToken')
    const token = req.cookies?.authToken || req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        status: 'error',
        code: ERROR_CODES.ERC7,
        message: ERROR_MESSAGES.ERC7
      });
    }

    // Verify token
    const decoded = JWTUtils.verifyToken(token);
    
    // Attach user info to request
    req.user = decoded;
    
    next();
  } catch (error) {
    
    if (error.message === 'Token expired') {
      return res.status(401).json({
        status: 'error',
        code: ERROR_CODES.ERC8,
        message: ERROR_MESSAGES.ERC8
      });
    }
    
    return res.status(401).json({
      status: 'error',
      code: ERROR_CODES.ERC9,
      message: ERROR_MESSAGES.ERC9
    });
  }
};

module.exports = authMiddleware;
