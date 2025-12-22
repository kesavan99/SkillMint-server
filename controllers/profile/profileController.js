const User = require('../../models/schemas/userSchema');

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware (req.user contains decoded JWT)

    const user = await User.findById(userId).select('-password -verificationToken -verificationTokenExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        name: user.name || '',
        email: user.email,
        phone: user.phone || '',
        profilePicture: user.profilePicture || '',
        lastLogin: user.lastLogin || null,
        details: {
          designation: user.details?.designation || 'N/A',
          areaOfInterest: user.details?.areaOfInterest || 'N/A'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware (req.user contains decoded JWT)
    const { name, phone, designation, areaOfInterest } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update basic fields if provided
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;

    // Initialize details object if it doesn't exist
    if (!user.details) {
      user.details = {
        designation: 'N/A',
        areaOfInterest: 'N/A'
      };
    }

    // Update details fields
    if (designation !== undefined && designation !== '') {
      user.details.designation = designation;
    }
    if (areaOfInterest !== undefined && areaOfInterest !== '') {
      user.details.areaOfInterest = areaOfInterest;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        name: user.name || '',
        email: user.email,
        phone: user.phone || '',
        profilePicture: user.profilePicture || '',
        lastLogin: user.lastLogin || null,
        details: {
          designation: user.details.designation,
          areaOfInterest: user.details.areaOfInterest
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
