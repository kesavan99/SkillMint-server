const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: function() {
      // Password is required only for email/password login
      return this.loginMethod === 'email';
    }
  },
  name: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  loginMethod: {
    type: String,
    enum: ['email', 'google'],
    default: 'email',
    required: true
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  profilePicture: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: function() {
      // Default false for email login (needs verification), true for Google
      return this.loginMethod === 'google';
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: function() {
      // Default 'active' for Google login, 'pending' for email
      return this.loginMethod === 'google' ? 'active' : 'pending';
    }
  },
  verificationToken: {
    type: String,
    sparse: true
  },
  verificationTokenExpires: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
  },
  details: {
    designation: {
      type: String,
      default: 'N/A',
      trim: true
    },
    areaOfInterest: {
      type: String,
      default: 'N/A',
      trim: true
    }
  },
  resumeDetails: [{
    resumeId: {
      type: String,
      required: true,
      unique: true
    },
    resumeName: {
      type: String,
      required: true,
      trim: true
    },
    resumeData: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    generatedDate: {
      type: Date,
      default: Date.now
    },
    templateName: {
      type: String,
      default: 'resume-template'
    },
    isDynamic: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
