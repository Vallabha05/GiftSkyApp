const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.post('/google-signin', authController.googleSignIn);

module.exports = router;
