const User = require('../models/schemas/userSchema');
const DataParser = require('../utils/dataParser');
const { ERROR_CODES, ERROR_MESSAGES } = require('../constants/errorCodes');

class UserService {
  static async createUser(apiData) {
    try {
      const cleanData = DataParser.parseUserData(apiData);
      
      // Merge clean data with additional fields (status, isActive, tokens, etc.)
      const userData = {
        ...cleanData,
        ...(apiData.loginMethod && { loginMethod: apiData.loginMethod }),
        ...(apiData.isActive !== undefined && { isActive: apiData.isActive }),
        ...(apiData.status && { status: apiData.status }),
        ...(apiData.verificationToken && { verificationToken: apiData.verificationToken }),
        ...(apiData.verificationTokenExpires && { verificationTokenExpires: apiData.verificationTokenExpires }),
        ...(apiData.googleId && { googleId: apiData.googleId }),
        ...(apiData.profilePicture && { profilePicture: apiData.profilePicture })
      };
      
      const user = new User(userData);
      await user.save();
      
      return {
        success: true,
        data: {
          id: user._id,
          email: user.email,
          name: user.name,
          loginMethod: user.loginMethod,
          createdAt: user.createdAt
        }
      };
    } catch (error) {
      if (error.code === 11000) {
        const customError = new Error(ERROR_MESSAGES.ERC16);
        customError.code = ERROR_CODES.ERC16;
        throw customError;
      }
      const customError = new Error(ERROR_MESSAGES.ERC12);
      customError.code = ERROR_CODES.ERC12;
      customError.originalError = error;
      throw customError;
    }
  }

  static async createOrUpdateGoogleUser(googleData) {
    try {
      const { email, name, googleId, profilePicture } = googleData;
      
      console.log('Creating or updating Google user:', { email, name, googleId, hasProfilePicture: !!profilePicture });
      
      // Check if user exists by email or googleId
      let user = await User.findOne({ 
        $or: [
          { email: email.toLowerCase() },
          { googleId: googleId }
        ]
      });

      console.log('Existing user found:', user ? { id: user._id, email: user.email, googleId: user.googleId, loginMethod: user.loginMethod } : null);

      let isNewUser = false;
      let needsPassword = false;

      if (user) {
        // Update existing user
        console.log('Updating existing user:', user._id);
        user.name = name || user.name;
        user.loginMethod = 'google';
        user.googleId = googleId;
        user.profilePicture = profilePicture || user.profilePicture;
        user.lastLogin = new Date();
        user.updatedAt = Date.now();
        user.isActive = true; // Make sure user is active
        user.status = 'active'; // Set status to active
        
        // Check if user needs to set password (no password OR inactive account)
        needsPassword = !user.password || user.password === '';
        
        console.log('Saving updated user...');
        await user.save();
        console.log('User updated successfully');
      } else {
        // Create new user
        console.log('Creating new user...');
        isNewUser = true;
        needsPassword = true;
        
        const newUserData = {
          email: email.toLowerCase(),
          name: name,
          loginMethod: 'google',
          googleId: googleId,
          profilePicture: profilePicture,
          isActive: true, // Google users are active by default
          status: 'active' // Set status to active for Google users
        };
        
        console.log('User data to be created:', newUserData);
        user = new User(newUserData);
        console.log('User object created, saving...');
        await user.save();
        console.log('New user created successfully:', user._id);
      }

      return {
        success: true,
        isNewUser,
        needsPassword,
        data: {
          id: user._id,
          email: user.email,
          name: user.name,
          loginMethod: user.loginMethod,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt
        }
      };
    } catch (error) {
      console.error('Error in createOrUpdateGoogleUser:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      
      // Handle specific MongoDB errors
      if (error.name === 'ValidationError') {
        console.error('Validation Error Details:', error.errors);
      }
      
      if (error.code === 11000) {
        console.error('Duplicate key error:', error.keyPattern, error.keyValue);
      }
      
      const customError = new Error(ERROR_MESSAGES.ERC12 + ': ' + error.message);
      customError.code = ERROR_CODES.ERC12;
      customError.originalError = error;
      throw customError;
    }
  }

  static async findUserByEmail(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      return user;
    } catch (error) {
      const customError = new Error(ERROR_MESSAGES.ERC5);
      customError.code = ERROR_CODES.ERC5;
      customError.originalError = error;
      throw customError;
    }
  }

  static async updateUser(identifier, updateData) {
    try {
      const cleanData = DataParser.sanitizeInput(updateData);
      
      // Support both email and _id
      const query = identifier.toString().includes('@') 
        ? { email: identifier.toLowerCase() }
        : { _id: identifier };
      
      const user = await User.findOneAndUpdate(
        query,
        { $set: { ...cleanData, updatedAt: Date.now() } },
        { new: true, runValidators: true }
      );

      if (!user) {
        const customError = new Error(ERROR_MESSAGES.ERC15);
        customError.code = ERROR_CODES.ERC15;
        throw customError;
      }

      return { success: true, data: user };
    } catch (error) {
      if (error.code && error.code.startsWith('ERC')) {
        throw error;
      }
      const customError = new Error(ERROR_MESSAGES.ERC13);
      customError.code = ERROR_CODES.ERC13;
      customError.originalError = error;
      throw customError;
    }
  }

  static async deleteUser(email) {
    try {
      const user = await User.findOneAndDelete({ email: email.toLowerCase() });
      if (!user) {
        const customError = new Error(ERROR_MESSAGES.ERC15);
        customError.code = ERROR_CODES.ERC15;
        throw customError;
      }
      return user;
    } catch (error) {
      if (error.code && error.code.startsWith('ERC')) {
        throw error;
      }
      const customError = new Error(ERROR_MESSAGES.ERC14);
      customError.code = ERROR_CODES.ERC14;
      customError.originalError = error;
      throw customError;
    }
  }

  static async getAllUsers(filters = {}) {
    try {
      const users = await User.find(filters).select('-password');
      return users;
    } catch (error) {
      const customError = new Error(ERROR_MESSAGES.ERC5);
      customError.code = ERROR_CODES.ERC5;
      customError.originalError = error;
      throw customError;
    }
  }
}

module.exports = UserService;
