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
  jobSearchLimit: {
    type: Number,
    default: 3,
    min: 0,
    required: true
  },
  credit: {
    type: Number,
    default: 2,
    min: 0
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralCreditsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  aiLimit: {
    type: Number,
    default: 3,
    min: 0
  },
  aiLimitResetDate: {
    type: Date,
    default: Date.now
  },
  plan: {
    type: Number,
    default: 1,
    min: 1,
    max: 3
  },
  jobSearchLimitExtensionRequest: {
    requested: {
      type: Boolean,
      default: false
    },
    requestedAt: {
      type: Date
    },
    message: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
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
      required: true
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
    },
    resumeFormat: {
      type: String,
      enum: ['classic', 'two-side', null],
      default: null
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
