const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { normalLimiter } = require('./middleware/rate-limiter');
const helmet = require("helmet");
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contactRoutes = require('./routes/contactRoutes');
const jobRoutes = require('./routes/jobRoutes');
const mongooseConnection = require('./models/mongooseConnection');
const nocache = require("nocache");
const browserManager = require('./services/browserManager');
const tabManager = require('./services/tabManager');

const app = express();
const PORT = process.env.PORT || 3000;

// If running behind a proxy (Vercel, Render, nginx) trust the proxy
// so secure cookies and req.protocol are detected correctly.
app.set('trust proxy', 1);

// Build allowed origin list from env or fallback to hardcoded list
const allowedOrigins = [
  'https://skillhubtools.store',
  'http://skillhubtools.store',
  'https://www.skillhubtools.store',
  // 'http://localhost:8080',
  // 'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(nocache());
app.use(helmet.noSniff());
app.use(helmet.xssFilter());  

app.use((req, res, next) => {
  if (req.path === "/skill-mint/check" || 
      req.path.startsWith("/skill-mint/user") || 
      req.path === "/skill-mint/resume/saved" || 
      req.path === "/api/resume/saved") {
    return next();
  }
  return normalLimiter(req, res, next);
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'bejewelled-alpaca-18236b.netlify.app','skillhubtools.store'],
    },
  })
);
app.use(helmet.dnsPrefetchControl({ allow: false }));
app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  })
);
app.use(helmet.frameguard({ action: "deny" }));

app.use('/skill-mint', authRoutes);
app.use('/skill-mint/user', profileRoutes);
app.use('/skill-mint/admin', adminRoutes);
app.use('/skill-mint/resume', resumeRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/jobs', jobRoutes);

app.get('/', (req, res) => {
  console.log(`Server is wake up`);
  res.json({
    message: 'Skill Mint Server is running',
    version: '1.0.0'
  });
});

const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongooseConnection.connect();
    
    // Initialize browser for job scraping (launches once)
    await browserManager.initialize();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await tabManager.closeAllTabs();
  await browserManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await tabManager.closeAllTabs();
  await browserManager.close();
  process.exit(0);
});

module.exports = app;
