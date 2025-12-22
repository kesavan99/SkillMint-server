const rateLimit = require("express-rate-limit");

const normalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    status: "error",
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests. This is a free service with rate limits. Please wait a moment and try again."
  },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  message: {
    status: "error",
    code: "TOO_MANY_REQUESTS_STRICT",
    message: "Too many requests. This is a free service with rate limits. Please wait 1 minute before trying again."
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { normalLimiter, strictLimiter };