const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();

router.get('/', authController.home);
router.get('/signup', authController.showSignup);
router.get('/login', authController.showLogin);
router.get('/forgot-password', authController.showForgotPassword);
router.post('/signup', authController.signup);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.get('/reset-password/:token', authController.showResetPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;
