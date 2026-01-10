const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/login/authController');
const VerificationController = require('../controllers/login/verificationController');
const { body, validationResult } = require('express-validator');
const { ERROR_CODES } = require('../constants/errorCodes');
const { strictLimiter } = require('../middleware/rate-limiter');

const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .trim(),
];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            code: ERROR_CODES.ERC6,
            errors: errors.array()
        });
    }
    next();
};

const googleLoginValidation = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('googleId')
        .notEmpty()
        .withMessage('Google ID is required')
        .trim(),
];

router.post('/logout', AuthController.logout);
router.post('/login',loginValidation, validate, AuthController.login);
router.post('/admin-login', AuthController.adminLogin);
router.post('/google-login', strictLimiter, googleLoginValidation, validate, AuthController.googleLogin);
router.post('/confirm-email', VerificationController.confirmEmail);
router.post('/forgot-password', VerificationController.forgotPassword);
router.post('/set-password', VerificationController.setPassword);
router.post('/set-google-password', VerificationController.setGooglePassword);
router.post('/verify-email', VerificationController.verifyEmail);
router.get('/check', AuthController.checkSession);

module.exports = router;
