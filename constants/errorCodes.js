const ERROR_CODES = {
  // Authentication errors (ERC1-ERC10)
  ERC1: 'ERC1', // Email and password are required
  ERC2: 'ERC2', // Email already registered
  ERC3: 'ERC3', // Email not found
  ERC4: 'ERC4', // Incorrect password
  ERC5: 'ERC5', // Internal server error
  ERC6: 'ERC6', // Validation error (invalid email format, etc.)
  ERC7: 'ERC7', // Authentication token required
  ERC8: 'ERC8', // Token expired
  ERC9: 'ERC9', // Invalid token
  
  // Database errors (ERC11-ERC20)
  ERC11: 'ERC11', // Database connection error
  ERC12: 'ERC12', // User creation failed
  ERC13: 'ERC13', // User update failed
  ERC14: 'ERC14', // User deletion failed
  ERC15: 'ERC15', // User not found
  ERC16: 'ERC16', // Duplicate email error
  
  // General errors (ERC21-ERC30)
  ERC21: 'ERC21', // Server startup error
  ERC22: 'ERC22', // Database initialization error
};

const ERROR_MESSAGES = {
  ERC1: 'Email and password are required',
  ERC2: 'Email already registered. Please login instead.',
  ERC3: 'Email not found. Please sign up first.',
  ERC4: 'Incorrect password',
  ERC5: 'Internal server error',
  ERC6: 'Validation error',
  ERC7: 'Authentication token required',
  ERC8: 'Token has expired. Please login again.',
  ERC9: 'Invalid authentication token',
  
  ERC11: 'Database connection error',
  ERC12: 'User creation failed',
  ERC13: 'User update failed',
  ERC14: 'User deletion failed',
  ERC15: 'User not found',
  ERC16: 'User with this email already exists',
  
  ERC21: 'Server startup error',
  ERC22: 'Database initialization error',
};

module.exports = {
  ERROR_CODES,
  ERROR_MESSAGES,
};
